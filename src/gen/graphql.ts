import { BaseGeneratorConfig } from 'src/config';
import { GContext } from '../context';
import { Register } from '../decorators';
import {
  newSchemaWithExtraProp,
  TscaDef,
  TscaMethod,
  TscaSchema,
} from '../types';
import { Generator } from './base';

interface GraphQLGeneratorExtension {
  // graphql files => types, queries and mutations
  files: Record<
    string,
    {
      queries: string[];
      mutations: string[];
      types: string[];
    }
  >;

  // types mentioned in input, which need to generate input version
  typeToInput: string[];
  // a list of types that already generated corresponding input types
  generatedInputs: Record<string, boolean>;
}

interface GraphQLGeneratorConfig extends BaseGeneratorConfig {
  scalars: Record<string, string>; // scalar -> output file,
  strInTs: boolean
}

@Register('gql')
export class GraphQLGenerator extends Generator<GraphQLGeneratorConfig> {
  public before(ctx: GContext) {
    ctx.genExt['gql'] = {
      files: {},
      typeToInput: [],
      generatedInputs: {},
    } as GraphQLGeneratorExtension;
  }
  public after(ctx: GContext) {
    if (this.config.strInTs) {
      ctx.addStrToTextFile(this.output, `export default \`\n`);
    }
    // handle custom scalars
    if (this.config.scalars) {
      for (const sc in this.config.scalars) {
        if (Object.prototype.hasOwnProperty.call(this.config.scalars, sc)) {
          const output = this.config.scalars[sc];
          ctx.addStrToTextFile(output, `scalar ${sc}\n`);
        }
      }
    }

    const ext = ctx.genExt['gql'] as GraphQLGeneratorExtension;

    while (ext.typeToInput.length > 0) {
      const ty = ext.typeToInput.pop();
      ext.generatedInputs[ty] = true;
      const schema = ctx.getTypeSchemaByName(ty);
      const inputTyName = this.getGqlInputTypeName(schema.name);
      const str = this.genGqlType(ctx, schema, inputTyName, 'input');
      ctx.addStrToTextFile(this.output, str);
    }

    for (const key in ext.files) {
      if (Object.prototype.hasOwnProperty.call(ext.files, key)) {
        const element = ext.files[key];
        const { queries, mutations, types } = element;
        if (types) {
          types.forEach((ty) => ctx.addStrToTextFile(key, ty));
        }
        if (queries.length != 0) {
          const queryStr = this.genGqlTypeRaw('Query', queries);
          ctx.addStrToTextFile(key, queryStr);
        }

        if (mutations.length != 0) {
          const mutationStr = this.genGqlTypeRaw('Mutation', mutations);
          ctx.addStrToTextFile(key, mutationStr);
        }
      }
    }

    if (this.config.strInTs) {
      ctx.addStrToTextFile(this.output, `\`\n`);
    }
  }

  private genGqlTypeRaw(typeName: string, content: string[]): string {
    return `
type ${typeName} {
  ${content.join('\n  ')}
}
`;
  }

  private getGqlInputTypeName(tName: string): string {
    return `${tName}Input`;
  }

  protected genTscaDef(ctx: GContext, def: TscaDef) {
    def.types.forEach((ty) => this.genTscaSchema(ctx, ty, null));
    def.usecases
      .flatMap((u) => u.methods)
      .filter((m) => !!m.gen.gql)
      .forEach((m) => this.genGqlQueryAndMut(ctx, m));
  }

  private genTscaSchema(
    ctx: GContext,
    schema: TscaSchema,
    overrideName: string,
    type = 'type',
    overrideOutput?: string,
  ) {
    if (!schema) {
      return;
    }
    if (schema.gen?.gql?.skip) {
      return;
    }
    if (schema.gen?.gql?.properties) {
      schema = newSchemaWithExtraProp(schema, schema.gen.gql.properties);
    }
    let str: string;
    if (schema.enum) {
      str = this.genGqlEnum(schema);
    } else {
      str = this.genGqlType(ctx, schema, overrideName, type);
    }
    str += '\n';
    const ext = ctx.genExt['gql'] as GraphQLGeneratorExtension;
    const dst = overrideOutput || schema.gen?.gql?.output || this.output;
    if (!(dst in ext.files)) {
      ext.files[dst] = {
        queries: [],
        mutations: [],
        types: [],
      };
    }
    ext.files[dst].types.push(str);
  }

  private genGqlType(
    ctx: GContext,
    schema: TscaSchema,
    overrideName: string,
    type = 'type',
  ): string {
    let federationKeyAnnotationStr = '';
    if (schema.gen?.gql?.fedFields) {
      federationKeyAnnotationStr = `@key(fields: "${schema.gen.gql.fedFields}")`;
    }
    let schemaStr = `${type} ${
      overrideName || schema.name
    } ${federationKeyAnnotationStr} {\n`;

    // generate properties for a GraphQL type
    
    schema.properties?.forEach((prop) => {
      let inputSuffix = false;
      // to see if we need to generate input version of this type
      if (type == 'input' && !this.isPrimitiveGqlType(prop)) {
        const ext = ctx.genExt['gql'] as GraphQLGeneratorExtension;
        let ty: string;
        if (prop.type == 'array') {
          ty = prop.items.type;
        } else {
          ty = prop.type;
        }
        const refSchema = ctx.getTypeSchemaByName(ty);

        if (!refSchema.enum) {
          inputSuffix = true;

          if (!(ty in ext.generatedInputs)) {
            if (!ext.typeToInput.includes(ty)) {
              ext.typeToInput.push(ty);
            }
          }
        }
      }
      const gqlTy = prop.gen?.gql?.type || this.getGqlType(prop, inputSuffix);
      const fieldName = prop.gen?.gql?.field || prop.name;
      const child = `  ${fieldName}: ${gqlTy}\n`;
      schemaStr += child;
    });

    schema.gen?.gql?.extraFields?.forEach(item => {
      const child = `  ${item.field}: ${item.type}\n`
      schemaStr += child;
    })
    schemaStr += '}\n';
    return schemaStr;
  }

  private genGqlEnum(schema: TscaSchema): string {
    const enumContent = schema.enum.map((e) => e.name).join('\n  ');
    const enumStr = `
enum ${schema.name} {
  ${enumContent} 
}`;
    return enumStr;
  }

  private genGqlQueryAndMut(ctx: GContext, method: TscaMethod) {
    if (!method.gen?.gql) {
      return;
    }

    const dst = method.parent.gen?.gql?.output || this.output;

    const ext = ctx.genExt['gql'] as GraphQLGeneratorExtension;
    let str: string;

    const resName = this.getTscaMethodResponseTypeName(method);
    this.genTscaSchema(ctx, method.res, resName, 'type', dst);
    if (!method.req || method.req.properties?.length == 0) {
      str = `${method.name}: ${resName}`;
    } else {
      const reqName = this.getTscaMethodRequestTypeName(method);
      this.genTscaSchema(ctx, method.req, reqName, 'input', dst);
      str = `${method.name}(request: ${reqName}): ${resName}`;
    }
    if (!(dst in ext.files)) {
      ext.files[dst] = {
        queries: [],
        mutations: [],
        types: [],
      };
    }
    if (method.gen.gql.type == 'query') {
      ext.files[dst].queries.push(str);
    } else {
      ext.files[dst].mutations.push(str);
    }
  }

  private isPrimitiveGqlType(schema: TscaSchema): boolean {
    if (schema.type == 'array') {
      return this.isPrimitiveGqlType(schema.items);
    }
    const types = [
      'string',
      'number',
      'integer',
      'boolean',
      'ID',
      'float',
      'bool',
      'int32',
      'i32',
    ];
    return types.includes(schema.type);
  }

  private getGqlType(schema: TscaSchema, input: boolean): string {
    if (schema.gen?.gql && schema.gen?.gql.type) {
      return schema.gen?.gql.type;
    }
    switch (schema.type) {
      case 'string':
        return 'String';
      case 'ID':
        return 'ID';
      case 'float':
        return 'Float';
      case 'int32':
      case 'i32':
      case 'number':
      case 'integer':
        return 'Int';
      case 'bool':
      case 'boolean':
        return 'Boolean';
      case 'object':
        throw new Error('anonymous object decleration is not allowed');
      case 'array':
        const itemType = this.getGqlType(schema.items, input);
        return `[${itemType}]`;
      default:
        if (input && !schema.enum) {
          return this.getGqlInputTypeName(schema.type);
        }
        return schema.type;
    }
  }
}
