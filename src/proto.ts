import { RawTscaDef, RawTscaSchema, RawTscaUsecase, TscaDef } from './types';
import * as pp from 'proto-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

import { GConfig } from './config';

export class Proto2Tsca {
  gconfig: GConfig = {
    generators: {},
    defs: [],
  };
  rawTscaDef: RawTscaDef = {
    types: {},
    usecases: {},
    schemas: {},
  };
  importedProtoFiles = {};

  async loadProtoFile(protoFile: string): Promise<void> {
    const content = await fs.readFile(protoFile, 'utf8');
    const protoResult = pp.parse(content, { resolve: false });
    if (protoResult.syntaxType == pp.SyntaxType.ProtoError) {
      throw new Error(
        `Parsing proto error on ${protoFile}: ${protoResult.message}`,
      );
    }
    const absPath = path.resolve(protoFile);
    this.importedProtoFiles[absPath];

    if (protoResult.imports) {
      for (const imp of protoResult.imports) {
        const impAbsPath = path.join(path.dirname(absPath), imp);
        if (impAbsPath in this.importedProtoFiles) {
          continue;
        }
        await this.loadProtoFile(impAbsPath);
      }
    }

    this.parseProto(this.gconfig, this.rawTscaDef, protoResult);
  }

  /**
   * Parse given proto doc into gconfig and rawTscaDef
   * @param gconfig
   * @param rawTscaDef
   * @param doc
   * @returns
   */
  parseProto(gconfig: GConfig, rawTscaDef: RawTscaDef, doc: pp.ProtoDocument) {
    if (doc.root.nested) {
      // loop message and enum first
      for (const key in doc.root.nested) {
        if (Object.prototype.hasOwnProperty.call(doc.root.nested, key)) {
          const element = doc.root.nested[key];
          switch (element.syntaxType) {
            case pp.SyntaxType.MessageDefinition: {
              const [name, schema] = protoMsg2RawTscaSchema(
                element as pp.MessageDefinition,
              );
              rawTscaDef.types[name] = schema;
              break;
            }

            case pp.SyntaxType.EnumDefinition: {
              const [name, schema] = protoEnum2RawTscaSchema(
                element as pp.EnumDefinition,
              );
              rawTscaDef.types[name] = schema;
              break;
            }
          }
        }
      }
    }

    // loop service later
    for (const key in doc.root.nested) {
      if (Object.prototype.hasOwnProperty.call(doc.root.nested, key)) {
        const element = doc.root.nested[key];
        switch (element.syntaxType) {
          case pp.SyntaxType.ServiceDefinition: {
            const [name, usecase] = protoSvcDef2RawTscaUsecase(
              element as pp.ServiceDefinition,
              this.rawTscaDef.types,
            );
            rawTscaDef.usecases[name] = usecase;
            break;
          }
        }
      }
    }

    // check global option
    if (doc.root.options) {
      for (const key in doc.root.options) {
        if (Object.prototype.hasOwnProperty.call(doc.root.options, key)) {
          const element = doc.root.options[key];
          const [option, path] = parseProtoOptionKey(key);
          if (!option.startsWith('zeus.gen.')) {
            console.error(`invalid global option ${key}`);
            continue;
          }
          const generator = option.substring(option.lastIndexOf('.') + 1);
          // TODO: valid generator naming

          if (!(generator in gconfig.generators)) {
            gconfig.generators[generator] = {} as any;
          }
          assignByObjPath(gconfig.generators[generator], path, element);
        }
      }
    }

    return rawTscaDef;
  }
}

function protoSvcDef2RawTscaUsecase(
  svcDef: pp.ServiceDefinition,
  ident2TscaTypes: Record<string, RawTscaSchema>,
): [string, RawTscaUsecase] {
  const rawTscaSvcDef: RawTscaUsecase = {
    gen: {},
    methods: {},
  };
  for (const key in svcDef.methods) {
    if (Object.prototype.hasOwnProperty.call(svcDef.methods, key)) {
      const element = svcDef.methods[key];
      rawTscaSvcDef.methods[key] = {
        req: ident2TscaTypes[element.requestType.value],
        res: ident2TscaTypes[element.responseType.value],
      };

      delete ident2TscaTypes[element.requestType.value];
      delete ident2TscaTypes[element.responseType.value];
    }
  }

  if (svcDef.options) {
    for (const key in svcDef.options) {
      if (Object.prototype.hasOwnProperty.call(svcDef.options, key)) {
        const element = svcDef.options[key];
        const [option, path] = parseProtoOptionKey(key);

        if (option === 'zeus.rest') {
          if (!('rest' in rawTscaSvcDef.gen)) {
            rawTscaSvcDef.gen.rest = {};
          }
          assignByObjPath(rawTscaSvcDef.gen.rest, path, element);
        } else if (option === 'zeus.ts') {
          if (!('ts' in rawTscaSvcDef.gen)) {
            rawTscaSvcDef.gen.ts = {};
          }
          assignByObjPath(rawTscaSvcDef.gen.ts, path, element);
        } else if (option === 'zeus.gql') {
          if (!('gql' in rawTscaSvcDef.gen)) {
            rawTscaSvcDef.gen.gql = {};
          }
          assignByObjPath(rawTscaSvcDef.gen.gql, path, element);
        }
      }
    }
  }
  return [svcDef.name, rawTscaSvcDef];
}

function protoEnum2RawTscaSchema(
  enumDef: pp.EnumDefinition,
): [string, RawTscaSchema] {
  const tscaSchema: RawTscaSchema = {
    properties: {},
    gen: {} as any,
    enum: [],
  };

  for (const key in enumDef.values) {
    if (Object.prototype.hasOwnProperty.call(enumDef.values, key)) {
      const element = enumDef.values[key];
      tscaSchema.enum.push({
        name: key,
        value: element,
      });
    }
  }

  return [enumDef.name, tscaSchema];
}

function protoMsg2RawTscaSchema(
  msgDef: pp.MessageDefinition,
): [string, RawTscaSchema] {
  const tscaSchema: RawTscaSchema = {
    properties: {},
    gen: {} as any,
  };

  for (const key in msgDef.fields) {
    if (Object.prototype.hasOwnProperty.call(msgDef.fields, key)) {
      const element = msgDef.fields[key];
      if (element.repeated) {
        tscaSchema.properties[key] = {
          type: 'array',
          items: {
            type: element.type.value,
          },
        };
      } else {
        tscaSchema.properties[key] = {
          type: element.type.value,
        };
      }

      tscaSchema.required = element.required;
    }
  }

  if (msgDef.options) {
    for (const key in msgDef.options) {
      if (Object.prototype.hasOwnProperty.call(msgDef.options, key)) {
        const element = msgDef.options[key];
        const [option, path] = parseProtoOptionKey(key);

        if (option === 'zeus.ge') {
          tscaSchema.gen['general_entity'] = {};
        } else if (option === 'zeus.gql') {
          if (!('gql' in tscaSchema.gen)) {
            tscaSchema.gen.gql = {};
          }
          assignByObjPath(tscaSchema.gen.gql, path, element);
        }
      }
    }
  }

  return [msgDef.name, tscaSchema];
}

function parseProtoOptionKey(key: string): [string, string] {
  const option_right_idx = key.indexOf(')');
  if (option_right_idx == -1) {
    throw new Error(`Expect ) in ${key}`);
  }
  const option = key.substring(1, option_right_idx);

  // skip ). in (xxx).path...
  const path = key.substring(option_right_idx + 2);

  return [option, path];
}

function assignByObjPath(obj: Record<string, any>, path: string, value: any) {
  const paths = path.split('.');
  let prev = null;
  let prevPath = null;
  let curr = obj;
  for (const p of paths) {
    if (p[0] == '_') {
      if (parseInt(p.substring(1)) != NaN) {
        if (!Array.isArray(prev[prevPath])) {
          prev[prevPath] = [];
        }
        prev[prevPath].push(value);
      }
    } else {
      if (!(p in curr)) {
        curr[p] = {};
      }
      prev = curr;
      curr = curr[p];
      prevPath = p;
    }
  }
  prev[paths[paths.length - 1]] = value;
}
