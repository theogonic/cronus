import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaSchema } from '../types';
import { Generator } from './base';
import { Register } from '../decorators';

interface GraphQLSchemaGeneratorExtension {
  queries: string[];
  mutations: string[];
  // types mentioned in input, which need to generate input version
  typeToInput: string[];
}

@Register('gql')
export class GraphQLSchemaGenerator extends Generator {
  public before(ctx: GContext) {
    ctx.genExt['gql'] = {
      queries: [],
      mutations: [],
      typeToInput: [],
    } as GraphQLSchemaGeneratorExtension;
  }
  public after(ctx: GContext) {
    const ext = ctx.genExt['gql'] as GraphQLSchemaGeneratorExtension;

    while (ext.typeToInput.length > 0) {
      const ty = ext.typeToInput.pop();

      const schema = ctx.getTypeSchemaByName(ty);
      const str = this.genGqlType(
        ctx,
        schema,
        this.getGqlInputTypeName(schema.name),
        'input',
      );
      ctx.addStrToTextFile(this.output, str);
    }
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

  private getGqlInputTypeName(tName: string): string {
    return `${tName}Input`;
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
      str = this.genGqlType(ctx, schema, overrideName, type);
    }
    str += '\n';
    ctx.addStrToTextFile(this.output, str);
  }

  private genGqlType(
    ctx: GContext,
    schema: TscaSchema,
    overrideName: string,
    type = 'type',
  ): string {
    let schemaStr = `${type} ${overrideName || schema.name} {\n`;
    schema.properties?.forEach((prop) => {
      // to see if we need to generate input version of this type
      if (type == 'input' && !this.isPrimitiveGqlTyoe(prop)) {
        const ext = ctx.genExt['gql'] as GraphQLSchemaGeneratorExtension;
        if (!ext.typeToInput.includes(prop.type)) {
          ext.typeToInput.push(prop.type);
        }
      }
      const gqlTy = this.getGqlType(prop, type == 'input');
      const child = `  ${prop.name}: ${gqlTy}\n`;
      schemaStr += child;
    });
    schemaStr += '}\n';
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
    const resName = this.getTscaMethodResponseTypeName(method);
    this.genTscaSchema(ctx, method.res, resName);
    if (!method.req || method.req.properties?.length == 0) {
      return `${method.name}: ${resName}`;
    }
    const reqName = this.getTscaMethodRequestTypeName(method);
    this.genTscaSchema(ctx, method.req, reqName, 'input');
    return `${method.name}(request: ${reqName}): ${resName}`;
  }

  private isPrimitiveGqlTyoe(schema: TscaSchema): boolean {
    if (schema.type == 'array') {
      return this.isPrimitiveGqlTyoe(schema.items);
    }
    const types = ['string', 'number', 'integer', 'boolean'];
    return types.includes(schema.type);
  }

  private getGqlType(schema: TscaSchema, input: boolean): string {
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
        const itemType = this.getGqlType(schema.items, input);
        return `[${itemType}]`;
      default:
        if (input) {
          return this.getGqlInputTypeName(schema.type);
        }
        return schema.type;
    }
  }
}
