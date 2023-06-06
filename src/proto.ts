import * as fs from 'fs/promises';
import * as path from 'path';
import * as pp from 'proto-parser';
import { GConfig } from './config';
import { RawTscaDef, RawTscaSchema, RawTscaUsecase } from './types';

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
  importedProtoFiles: Record<string, unknown> = {};
  ident2ProtoMsgDefs: Record<string, pp.MessageDefinition> = {};

  async loadProtoFile(protoFile: string): Promise<void> {
    const content = await fs.readFile(protoFile, 'utf8');
    const protoResult = pp.parse(content, { resolve: false });
    if (protoResult.syntaxType == pp.SyntaxType.ProtoError) {
      throw new Error(
        `Parsing proto error on ${protoFile} line ${protoResult.line}: ${protoResult.message}`,
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
              this.ident2ProtoMsgDefs[name] = element as pp.MessageDefinition;
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
              this.ident2ProtoMsgDefs,
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
  ident2ProtoMsgDefs: Record<string, pp.MessageDefinition>,
): [string, RawTscaUsecase] {
  const rawTscaSvcDef: RawTscaUsecase = {
    gen: {},
    methods: {},
  };
  for (const key in svcDef.methods) {
    if (Object.prototype.hasOwnProperty.call(svcDef.methods, key)) {
      const protoMethod = svcDef.methods[key];
      rawTscaSvcDef.methods[key] = {
        req: ident2TscaTypes[protoMethod.requestType.value],
        res: ident2TscaTypes[protoMethod.responseType.value],
        gen: {},
      };
      const rawTscaMethod = rawTscaSvcDef.methods[key];

      const reqProtoMsg = ident2ProtoMsgDefs[protoMethod.requestType.value];
      for (const msgFieldKey in reqProtoMsg.fields) {
        if (
          Object.prototype.hasOwnProperty.call(reqProtoMsg.fields, msgFieldKey)
        ) {
          const msgField = reqProtoMsg.fields[msgFieldKey];
          for (const msgFieldOpKey in msgField.options) {
            if (
              Object.prototype.hasOwnProperty.call(
                msgField.options,
                msgFieldOpKey,
              )
            ) {
              const [option] = parseProtoOptionKey(msgFieldOpKey);
              if (option === 'zeus.rest.query') {
                if (!('rest' in rawTscaMethod.gen)) {
                  rawTscaMethod.gen.rest = {} as any;
                }
                if (!('query' in rawTscaMethod.gen.rest)) {
                  rawTscaMethod.gen.rest.query = [];
                }
                rawTscaMethod.gen.rest.query.push(msgField.name);
              }
            }
          }
        }
      }

      delete ident2TscaTypes[protoMethod.requestType.value];
      delete ident2TscaTypes[protoMethod.responseType.value];

      // check method level option
      if (protoMethod.options) {
        for (const key in protoMethod.options) {
          if (Object.prototype.hasOwnProperty.call(protoMethod.options, key)) {
            const element = protoMethod.options[key];
            const [option, path] = parseProtoOptionKey(key);
            if (option === 'zeus.rest') {
              if (!('rest' in rawTscaMethod.gen)) {
                rawTscaMethod.gen.rest = {} as any;
              }
              assignByObjPath(rawTscaMethod.gen.rest, path, element);
            } else if (option === 'zeus.gql') {
              if (!('gql' in rawTscaMethod.gen)) {
                rawTscaMethod.gen.gql = {} as any;
              }
              assignByObjPath(rawTscaMethod.gen.gql, path, element);
            }
          }
        }
      }
    }
  }

  // check service level option
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
        } else if (option === 'zeus.gql_resolver') {
          if (!('gql_resolver' in rawTscaSvcDef.gen)) {
            rawTscaSvcDef.gen.gql_resolver = {};
          }
          assignByObjPath(rawTscaSvcDef.gen.gql_resolver, path, element);
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
      const protoField = msgDef.fields[key];
      if (protoField.repeated) {
        tscaSchema.properties[key] = {
          type: 'array',
          items: {
            type: protoField.type.value,
          },
        };
      } else {
        tscaSchema.properties[key] = {
          type: protoField.type.value,
        };
      }

      const fieldSchema = tscaSchema.properties[key];

      tscaSchema.required = protoField.required;

      if (protoField.options) {
        for (const key in protoField.options) {
          if (Object.prototype.hasOwnProperty.call(protoField.options, key)) {
            const element = protoField.options[key];
            const [option, path] = parseProtoOptionKey(key);
            if (option === 'zeus.gql') {
              if (!('gen' in fieldSchema)) {
                fieldSchema.gen = {};
              }
              if (!('gql' in fieldSchema.gen)) {
                fieldSchema.gen.gql = {};
              }
              assignByObjPath(fieldSchema.gen.gql, path, element);
            } else if (option === 'zeus.ts') {
              if (!('gen' in fieldSchema)) {
                fieldSchema.gen = {};
              }
              if (!('ts' in fieldSchema.gen)) {
                fieldSchema.gen.ts = {};
              }
              assignByObjPath(fieldSchema.gen.ts, path, element);
            }
          }
        }
      }
    }
  }

  if (msgDef.options) {
    for (const key in msgDef.options) {
      if (Object.prototype.hasOwnProperty.call(msgDef.options, key)) {
        const element = msgDef.options[key];
        const [option, path] = parseProtoOptionKey(key);

        if (option === 'zeus.gaea') {
          tscaSchema.gen['gaea'] = {};
        } else if (option === 'zeus.gql') {
          if (!('gql' in tscaSchema.gen)) {
            tscaSchema.gen.gql = {};
          }
          assignByObjPath(tscaSchema.gen.gql, path, element);
        } else if (option === 'zeus.angular_form') {
          tscaSchema.gen['angular_form'] = true;
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
      if (!Number.isNaN(parseInt(p.substring(1)))) {
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
