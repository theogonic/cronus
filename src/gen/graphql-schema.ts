import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaSchema } from '../types';
import { Generator } from './base';
import { Register } from '../decorators';

interface GraphQLSchemaGeneratorExtension {
  queries: string[];
  mutations: string[];
}

@Register('gql')
export class GraphQLSchemaGenerator extends Generator {
  public before(ctx: GContext) {
    ctx.genExt['gql'] = {
      queries: [],
      mutations: [],
    } as GraphQLSchemaGeneratorExtension;
  }
  public after(ctx: GContext) {
    const ext = ctx.genExt['gql'] as GraphQLSchemaGeneratorExtension;

    if (ext.queries) {
      const queryStr = this.genGqlTypeRaw('Query', ext.queries);
      ctx.addStrToTextFile(this.output, queryStr);
    }

    if (ext.mutations) {
      const mutationStr = this.genGqlTypeRaw('Mutation', ext.mutations);
      ctx.addStrToTextFile(this.output, mutationStr);
    }
  }

  private genGqlTypeRaw(typeName: string, content: string[]): string {
    return `
      type ${typeName} {
        ${content.join('\n')}
      }
    `;
  }
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    def.types.forEach((ty) => this.genTscaSchema(ctx, ty, null));
    const methods = def.usecases
      .flatMap((u) => u.methods)
      .filter((m) => !!m.gen.gql);

    const queries = methods
      .filter((m) => m.gen.gql.type == 'query')
      .map((m) => this.genGqlQueryAndMut(ctx, m));

    const mutations = methods
      .filter((m) => m.gen.gql.type == 'mutation')
      .map((m) => this.genGqlQueryAndMut(ctx, m));

    const ext = ctx.genExt['gql'] as GraphQLSchemaGeneratorExtension;

    ext.queries.push(...queries);
    ext.mutations.push(...mutations);
  }

  private genTscaSchema(
    ctx: GContext,
    schema: TscaSchema,
    overrideName: string,
    type = 'type',
  ) {
    if (!schema) {
      return;
    }
    let str: string;
    if (schema.enum) {
      str = this.genGqlEnum(schema);
    } else {
      str = this.genGqlType(schema, overrideName, type);
    }
    str += '\n';
    ctx.addStrToTextFile(this.output, str);
  }

  private genGqlType(
    schema: TscaSchema,
    overrideName: string,
    type = 'type',
  ): string {
    let schemaStr = `${type} ${overrideName || schema.name} {\n`;
    schema.properties?.forEach((prop) => {
      const gqlTy = this.getGqlType(prop);
      const child = `  ${prop.name}: ${gqlTy}\n`;
      schemaStr += child;
    });
    schemaStr += '}';
    return schemaStr;
  }

  private genGqlEnum(schema: TscaSchema): string {
    const enumContent = schema.enum.map((e) => e.name).join('    \n');
    const enumStr = `enum ${schema.name} {
      ${enumContent} 
    }`;
    return enumStr;
  }

  private genGqlQueryAndMut(ctx: GContext, method: TscaMethod): string {
    const reqName = this.getTscaMethodRequestTypeName(method);
    const resName = this.getTscaMethodResponseTypeName(method);
    this.genTscaSchema(ctx, method.req, reqName, 'input');
    this.genTscaSchema(ctx, method.res, resName);

    return `${method.name}(request: ${reqName}): ${resName}`;
  }

  private getGqlType(schema: TscaSchema): string {
    if (schema.gen?.gql && schema.gen?.gql.type) {
      return schema.gen?.gql.type;
    }
    switch (schema.type) {
      case 'string':
        return 'String';
      case 'number':
      case 'integer':
        return 'Int';
      case 'boolean':
        return 'Boolean';
      case 'object':
        throw new Error('anonymous object decleration is not allowed');
      case 'array':
        const itemType = this.getGqlType(schema.items);
        return `[${itemType}]`;
      default:
        return schema.type;
    }
  }
}
