import * as _ from 'lodash';

export interface RawTscaUsecase {
  methods?: Record<string, RawTscaMethod>;
  gen?: TscaUsecaseGen;
}

export interface TscaUsecaseRule {
  pattern?: string;
  method: RawTscaMethod;
}

export interface TsItem {
  type: 'string' | 'ident' | 'object';
  value: string | Record<string, unknown>;
}
export interface TsDecoratorDecl {
  from: string;
  name: string;
  params?: TsItem[];
}

export interface RawTscaMethodRest {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  query?: string[];
  // import -> from
  extraImports?: Record<string, string>;
  methodDecorators?: Record<string, TsDecoratorDecl>;
  reqParams?: Record<string, RawTscaCustomAssignment>;
}

// This is used for custom assignment for service's request's parameter
export interface RawTscaCustomAssignment {
  decorator?: TsDecoratorDecl;
  // TODO: function call, constant, etc..
}

export interface RawTscaUsecaseRest {
  apiPrefix?: string;
  apiTags?: string[];
  apiTag?: string;
  apiBearerAuth?: boolean;
  // custom assignment for service's request's parameter
  reqParams?: Record<string, RawTscaCustomAssignment>;
}

export interface RawTscaMethodGql {
  type: 'mutation' | 'query';
}

export interface RawTscaUsecaseGqlNestjs {
  // any context's property want to pass to request
  ctx2req?: Record<string, string>;
}

export interface TscaMethodGen {
  rest?: RawTscaMethodRest;
  gql?: RawTscaMethodGql;
}

export interface RawTscaMethod {
  gen?: TscaMethodGen;
  req?: RawTscaSchema;
  res?: RawTscaSchema;
}

export interface RawTscaSchemaGql {
  // weither skip generating
  skip?: boolean;
  // special graphql type, like ID, Float, or other custom scalar
  type?: string;

  // replace original field name with
  field?: string;

  fedFields?: string;
  // custom output graphql file
  output?: string;
  properties?: Record<string, RawTscaSchema>;
}

export interface RawTscaSchemaTs {
  const_type?: string | number | boolean;
}

export interface RawTscaSchemaSql {
  tableName?: string;
  type?: string;
  primary?: boolean;
  ref?: {
    type?: string;
    field?: string;
    new?: number;
    depricated?: number;
  },
  search?: { 
    type: "fulltext";
    new?: number;
    depricated?: number;
  }
}

interface TscaSchemaGen {
  gql?: RawTscaSchemaGql;
  gaea?: unknown;
  ts?: RawTscaSchemaTs;
  angular_form?: boolean;
  sql?: RawTscaSchemaSql;
  new?: RawTscaSchemaGenNew;
  deprecated?: RawTscaSchemaDeprecated;
}

interface RawTscaSchemaGenNew {
  version?: number
}

interface RawTscaSchemaDeprecated {
  version?: number
}

interface RawTscaUsecaseGql {
  output?: string;
}

interface RawTscaUsecaseTs {
  // extend ty -> import's from
  reqExtends?: Record<string, string>;
}

interface TscaUsecaseGen {
  ts?: RawTscaUsecaseTs;
  rest?: RawTscaUsecaseRest;
  gql?: RawTscaUsecaseGql;
  gql_resolver?: RawTscaUsecaseGqlNestjs;
}

interface TscaSchemaEnumItem {
  name: string;
  value: number;
}
export interface RawTscaSchema {
  type?: string;
  items?: RawTscaSchema;
  properties?: Record<string, RawTscaSchema>;
  required?: boolean;
  namespace?: string;
  enum?: TscaSchemaEnumItem[];
  gen?: TscaSchemaGen;
  extends?: Record<string, string>;
  flatExtends?: string[];
}

export interface RawTscaDef {
  /**
   * Types referenced in the usecase declaration,
   * usually are mentioned in request or response
   */
  types: Record<string, RawTscaSchema>;

  /**
   * All usecases parsed from the given files
   */
  usecases: Record<string, RawTscaUsecase>;

  schemas: Record<string, RawTscaSchema>;
}

interface BaseTscaDefProp {
  name?: string;
  // source file
  src: string;
  parent?: BaseTscaDefComponent<any>;
}

abstract class BaseTscaDefComponent<T> {
  public readonly src: string;
  public readonly name: string;
  public readonly parent: BaseTscaDefComponent<any>;
  public raw: T;
  constructor(prop: BaseTscaDefProp) {
    this.src = prop.src;
    this.name = prop.name;
    this.parent = prop.parent;
  }
}

export class TscaDef extends BaseTscaDefComponent<RawTscaDef> {
  types: TscaSchema[] = [];
  usecases: TscaUsecase[] = [];

  public getTypeSchemaByName(name: string): TscaSchema | null {
    return this.types.find((schema) => schema.name == name);
  }

  static fromRaw(raw: RawTscaDef, prop: BaseTscaDefProp): TscaDef {
    const def = new TscaDef(prop);
    def.raw = raw;
    const { types, usecases } = raw;
    for (const name in types) {
      if (Object.prototype.hasOwnProperty.call(types, name)) {
        const t = types[name];
        const child = TscaSchema.fromRaw(t, {
          src: prop.src,
          name,
          parent: null,
        });
        def.types.push(child);
      }
    }

    for (const name in usecases) {
      if (Object.prototype.hasOwnProperty.call(usecases, name)) {
        const usecase = usecases[name];
        const child = TscaUsecase.fromRaw(usecase, {
          src: prop.src,
          name,
        });
        def.usecases.push(child);
      }
    }

    return def;
  }
}

export class TscaUsecase extends BaseTscaDefComponent<RawTscaUsecase> {
  methods: TscaMethod[] = [];
  gen?: TscaUsecaseGen;
  static fromRaw(raw: RawTscaUsecase, prop: BaseTscaDefProp): TscaUsecase {
    const u = new TscaUsecase(prop);
    u.gen = raw.gen;
    u.raw = raw;
    if (raw.methods) {
      for (const metholdName in raw.methods) {
        if (Object.prototype.hasOwnProperty.call(raw.methods, metholdName)) {
          const rawMethod = raw.methods[metholdName];
          const method = TscaMethod.fromRaw(rawMethod, {
            src: prop.src,
            name: metholdName,
            parent: u,
          });
          u.methods.push(method);
        }
      }
    }

    return u;
  }
}

export class TscaSchema extends BaseTscaDefComponent<RawTscaSchema> {
  type: string;
  items?: TscaSchema;
  properties?: TscaSchema[] = [];
  required: boolean;
  namespace: string;
  gen?: TscaSchemaGen;
  enum?: TscaSchemaEnumItem[];
  // extend class -> optional import's from if need import
  extends?: Record<string, string>;
  flatExtends?: string[];
  isVoid(): boolean {
    return (
      !this.items &&
      !this.properties &&
      !this.enum &&
      !this.extends &&
      !this.flatExtends
    );
  }
  getPropByName(name: string, allowNotExist = false): TscaSchema {
    const prop = this.properties?.find((prop) => prop.name === name);
    if (!prop && !allowNotExist) {
      throw new Error(
        `cannot find '${name}' in properties of type '${this.type}'`,
      );
    }
    return prop;
  }

  addProp(prop: TscaSchema) {
    if (this.getPropByName(prop.name, true)) {
      throw new Error(
        `${prop.name} already existed in type ${this.name || this.type}`,
      );
    }
    this.properties.push(prop);
  }

  inheritFromRaw(schema: RawTscaSchema): void {
    this.extends = schema.extends;
    this.flatExtends = schema.flatExtends;
    if (schema.properties) {
      for (const prop in schema.properties) {
        if (Object.prototype.hasOwnProperty.call(schema.properties, prop)) {
          const childSchema = schema.properties[prop];
          if (this.getPropByName(prop, true)) {
            throw new Error(
              `found duplicated property '${prop}' in type '${this.name}'`,
            );
          }

          this.addProp(
            TscaSchema.fromRaw(childSchema, {
              src: this.src,
              name: prop,
            }),
          );
        }
      }
    }
  }

  static fromRaw(raw: RawTscaSchema, prop: BaseTscaDefProp): TscaSchema {
    const { properties, type, namespace, items, required, gen } = raw;
    const schema = new TscaSchema(prop);
    schema.raw = raw;
    schema.extends = raw.extends;
    schema.flatExtends = raw.flatExtends;
    schema.type = type;
    schema.enum = raw['enum'];
    schema.namespace = namespace;
    schema.required = required;
    if (items) {
      schema.items = TscaSchema.fromRaw(items, {
        src: prop.src,
        name: '',
        parent: schema,
      });
    }
    schema.gen = gen;

    if (properties) {
      for (const propName in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, propName)) {
          const childSchema = TscaSchema.fromRaw(properties[propName], {
            src: prop.src,
            name: propName,
            parent: schema,
          });

          schema.properties.push(childSchema);
        }
      }
    }

    autoCompleteMetaIfGaea(schema);

    return schema;
  }
}

function getTscaMethodRequestTypeName(method: TscaMethod): string {
  return _.upperFirst(method.name) + 'Request';
}

function getTscaMethodResponseTypeName(method: TscaMethod): string {
  return _.upperFirst(method.name) + 'Response';
}

export class TscaMethod extends BaseTscaDefComponent<RawTscaMethod> {
  gen?: TscaMethodGen;
  req?: TscaSchema;
  res?: TscaSchema;
  readonly parent: TscaUsecase;
  static fromRaw(raw: RawTscaMethod, prop: BaseTscaDefProp): TscaMethod {
    const method = new TscaMethod(prop);

    if (!raw) {
      raw = {};
    }
    method.raw = raw;
    if (raw.req) {
      method.req = TscaSchema.fromRaw(raw.req, {
        src: prop.src,
        name: getTscaMethodRequestTypeName(method),
        parent: null,
      });
    }

    if (raw.res) {
      method.res = TscaSchema.fromRaw(raw.res, {
        src: prop.src,
        name: getTscaMethodResponseTypeName(method),
        parent: null,
      });
    }

    method.gen = raw.gen || {};

    return method;
  }
}

export function newSchemaWithExtraProp(
  schema: TscaSchema,
  properties: Record<string, RawTscaSchema>,
): TscaSchema {
  const newRaw = { ...schema.raw };
  const clone: TscaSchema = TscaSchema.fromRaw(newRaw, {
    name: schema.name,
    src: schema.src,
  });
  clone.inheritFromRaw({ properties });
  return clone;
}

/**
 * Add meta: GeneralObjectMeta to schema properties if schema is marked with gen general-entity
 */
function autoCompleteMetaIfGaea(schema: TscaSchema) {
  if (!schema.gen) {
    return;
  }
  if ('gaea' in schema.gen) {
    const metaSchema = schema.getPropByName('meta', true);
    if (metaSchema) {
      if (metaSchema.type !== 'GeneralObjectMeta') {
        throw new Error(
          `type of 'meta' in type '${schema.name}' expected to be 'GeneralObjectMeta'`,
        );
      }
    } else {
      if (!schema.properties) {
        schema.properties = [];
      }
      const autoCreatedMetaSchema = new TscaSchema({
        src: schema.src,
        name: 'meta',
      });
      autoCreatedMetaSchema.type = 'GeneralObjectMeta';
      schema.properties.push(autoCreatedMetaSchema);
    }
  }
}
