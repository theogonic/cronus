import { GContext } from '../context';
import { TscaDef, TscaSchema } from '../types';
import { Generator } from './base';
import { Register } from '../decorators';

@Register('gql')
export class GraphQLSchemaGenerator extends Generator {
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    def.types.forEach((ty) => this.genTscaSchema(ctx, ty));
  }

  private genTscaSchema(ctx: GContext, schema: TscaSchema) {
    let str: string;
    if (schema.enum) {
      str = this.genGqlEnum(schema);
    } else {
      str = this.genGqlType(schema);
    }
    str += '\n';
    ctx.addStrToTextFile(this.output, str);
  }

  private genGqlType(schema: TscaSchema): string {
    let schemaStr = `type ${schema.name} {\n`;
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
