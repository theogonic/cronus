import * as ts from 'typescript';
import { GConfig } from './config';
import { TscaDef, TscaSchema } from './types';

export interface TsFileContext {
  nodes: ts.Node[];

  // import path(from) => a list of import item
  imports: Record<string, string[]>;
}

export interface TsImport {
  from: string;
  items: string[];
}

/**
 * Generation Context
 */
export class GContext {
  // relative file path => a list of nodes
  tsFiles: Record<string, TsFileContext>;
  // relative file path => file content
  textFiles: Record<string, string>;
  // all types defined in 'types' of the given tsca defs
  // expected to be initialized before call 'generator.generate(...)'
  // schema name => schema
  types: Record<string, TscaSchema>;

  constructor(private readonly gConfig: GConfig) {
    this.tsFiles = {};
    this.textFiles = {};
    this.types = {};
  }

  addTypesFromDef(def: TscaDef): void {
    def.types.forEach((tySchema) => {
      if (tySchema.name in this.types) {
        throw new Error(`found duplicated type '${tySchema.name}' in 
        '${this.types[tySchema.name].src}'
        '${tySchema.src}'
        `);
      }
      this.types[tySchema.name] = tySchema;
    });
  }

  getTypeSchemaByName(name: string): TscaSchema {
    if (!(name in this.types)) {
      throw new Error(`cannot find type '${name}'`);
    }
    return this.types[name];
  }

  getOutputByGeneratorId(gId: string) {
    if (!(gId in this.gConfig.generators)) {
      throw new Error(`missing generator '${gId}' in config yaml`);
    }
    return this.gConfig.generators[gId].output;
  }

  addStrToTextFile(file: string, contentToAppend: string): void {
    if (!(file in this.textFiles)) {
      this.textFiles[file] = contentToAppend;
    } else {
      this.textFiles[file] += contentToAppend;
    }
  }

  addNodesToTsFile(file: string, ...nodes: ts.Node[]) {
    if (!(file in this.tsFiles)) {
      this.tsFiles[file] = {
        nodes: [],
        imports: {},
      };
    }

    this.tsFiles[file].nodes.push(...nodes);
  }

  addImportsToTsFile(file: string, ...imports: TsImport[]) {
    if (!(file in this.tsFiles)) {
      this.tsFiles[file] = {
        nodes: [],
        imports: {},
      };
    }

    const fileCtx = this.tsFiles[file];

    const existedImports = fileCtx.imports;
    if (imports) {
      for (const imp of imports) {
        if (!imp.items) {
          continue;
        }
        for (const item of imp.items) {
          if (!(imp.from in existedImports)) {
            existedImports[imp.from] = [];
          }
          if (!existedImports[imp.from].includes(item)) {
            existedImports[imp.from].push(item);
          }
        }
      }
    }
  }
}
