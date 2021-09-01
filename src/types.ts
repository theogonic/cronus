export interface RawTscaUsecase {
  methods?: Record<string, RawTscaMethod>;
  rules?: TscaUsecaseRule[];
  gen?: TscaUsecaseGen;
}

export interface TscaUsecaseRule {
  pattern?: string;
  method: RawTscaMethod;
}

interface RawTsImport {
  from?: string;
  names?: string[];
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

export interface TscaMethodRestParamDecoratorDecl extends TsDecoratorDecl {
  reqProp: string;
}

export interface RawTscaMethodRest {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  query?: string[];
  extraImports?: RawTsImport[];
  methodDecorators?: TsDecoratorDecl[];
  paramDecorators?: TscaMethodRestParamDecoratorDecl[];
}

export interface RawTscaUsecaseRest {
  apiPrefix: string;
  apiTags: string[];
}

export interface RawTscaMethodGql {
  type: 'mutation' | 'query';
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
  // special graphql type, like ID, Float, or other custom scalar
  type: string;
}

interface TscaSchemaGen {
  gql?: RawTscaSchemaGql;
  'general-entity': {};
}

interface TscaUsecaseGen {
  rest?: RawTscaUsecaseRest;
}

interface TscaSchemaEnumItem {
  name: string;
  value?: string;
}
export interface RawTscaSchema {
  type?: string;
  items?: RawTscaSchema;
  properties?: Record<string, RawTscaSchema>;
  required?: boolean;
  namespace?: string;
  enum?: TscaSchemaEnumItem[];
  gen?: TscaSchemaGen;
  extends?: string[];
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
}

interface BaseTscaDefProp {
  name?: string;
  // source file
  src: string;
  parent?: BaseTscaDefComponent;
}

abstract class BaseTscaDefComponent {
  public readonly src: string;
  public readonly name: string;
  public readonly parent: BaseTscaDefComponent;
  constructor(prop: BaseTscaDefProp) {
    this.src = prop.src;
    this.name = prop.name;
    this.parent = prop.parent;
  }
}

export class TscaDef extends BaseTscaDefComponent {
  types: TscaSchema[] = [];
  usecases: TscaUsecase[] = [];

  public getTypeSchemaByName(name: string): TscaSchema | null {
    return this.types.find((schema) => schema.name == name);
  }

  static fromRaw(raw: RawTscaDef, prop: BaseTscaDefProp): TscaDef {
    const def = new TscaDef(prop);

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

export class TscaUsecase extends BaseTscaDefComponent {
  methods: TscaMethod[] = [];
  rules?: TscaUsecaseRule[];
  gen?: TscaUsecaseGen;
  static fromRaw(raw: RawTscaUsecase, prop: BaseTscaDefProp): TscaUsecase {
    const u = new TscaUsecase(prop);
    u.rules = raw.rules;
    u.gen = raw.gen;
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

export class TscaSchema extends BaseTscaDefComponent {
  type: string;
  items: TscaSchema;
  properties?: TscaSchema[] = [];
  required: boolean;
  namespace: string;
  gen?: TscaSchemaGen;
  enum?: TscaSchemaEnumItem[];
  extends?: string[];
  flatExtends?: string[];
  getPropByName(name: string, allowNotExist = false): TscaSchema {
    const prop = this.properties?.find((prop) => prop.name === name);
    if (!prop && !allowNotExist) {
      throw new Error(
        `cannot find '${name}' in properties of type '${this.name}'`,
      );
    }
    return prop;
  }
  inheritFrom(schema: RawTscaSchema): void {
    this.extends = schema.extends;
    this.flatExtends = schema.flatExtends;
    if (schema.properties) {
      for (const prop in schema.properties) {
        if (Object.prototype.hasOwnProperty.call(schema.properties, prop)) {
          const childSchema = schema.properties[prop];
          if (prop in this.properties) {
            throw new Error(
              `found duplicated property '${prop}' in type '${this.name}'`,
            );
          }
          schema.properties[prop] = childSchema;
        }
      }
    }
  }
  static fromRaw(raw: RawTscaSchema, prop: BaseTscaDefProp): TscaSchema {
    const { properties, type, namespace, items, required, gen } = raw;
    const schema = new TscaSchema(prop);
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

    autoCompleteMetaIfGe(schema);

    return schema;
  }
}

export class TscaMethod extends BaseTscaDefComponent {
  gen?: TscaMethodGen;
  req?: TscaSchema;
  res?: TscaSchema;
  readonly parent: TscaUsecase;
  static fromRaw(raw: RawTscaMethod, prop: BaseTscaDefProp): TscaMethod {
    const method = new TscaMethod(prop);
    if (!raw) {
      raw = {};
    }
    if (raw.req) {
      method.req = TscaSchema.fromRaw(raw.req, {
        src: prop.src,
        name: '',
        parent: null,
      });
    }

    if (raw.res) {
      method.res = TscaSchema.fromRaw(raw.res, {
        src: prop.src,
        name: '',
        parent: null,
      });
    }

    method.gen = raw.gen || {};

    applyRulesToMethod(method.parent.rules, method);
    return method;
  }
}

function applyRulesToMethod(
  rules: TscaUsecaseRule[],
  method: TscaMethod,
): void {
  if (!rules) {
    return;
  }
  if (!method) {
    throw new Error(`unexpected null method found`);
  }

  rules
    .filter((rule) => new RegExp(rule.pattern).test(method.name))
    .forEach((rule) => applyRuleToMethod(rule, method));
}

function applyRuleToMethod(rule: TscaUsecaseRule, method: TscaMethod): void {
  if (rule.method.req) {
    if (method.req) {
      method.req.inheritFrom(rule.method.req);
    } else {
      method.req = TscaSchema.fromRaw(rule.method.req, {
        src: method.src,
      });
    }
  }

  if (rule.method.res) {
    if (method.res) {
      method.res.inheritFrom(rule.method.res);
    } else {
      method.res = TscaSchema.fromRaw(rule.method.res, {
        src: method.src,
      });
    }
  }

  if (rule.method.gen) {
    if (rule.method.gen.rest) {
      const rest = rule.method.gen.rest;
      if (method.gen?.rest) {
        method.gen.rest = inheritFromRest(method.gen.rest, rest);
      } else {
        if (!method.gen) {
          method.gen = {};
        }
        method.gen.rest = rest;
      }
    }
  }
}

/**
 * Add meta: GeneralObjectMeta to schema properties if schema is marked with gen general-entity
 */

function autoCompleteMetaIfGe(schema: TscaSchema) {
  if (!schema.gen) {
    return;
  }
  if ('general-entity' in schema.gen) {
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
function inheritFromRest(
  curr: RawTscaMethodRest,
  from: RawTscaMethodRest,
): RawTscaMethodRest {
  const newRest = { ...curr };
  if (from.extraImports) {
    if (!newRest.extraImports) {
      newRest.extraImports = [];
    }
    newRest.extraImports = [...newRest.extraImports, ...from.extraImports];
  }

  if (from.methodDecorators) {
    if (!newRest.methodDecorators) {
      newRest.methodDecorators = [];
    }
    newRest.methodDecorators = [
      ...newRest.methodDecorators,
      ...from.methodDecorators,
    ];
  }

  if (from.paramDecorators) {
    if (!newRest.paramDecorators) {
      newRest.paramDecorators = [];
    }
    newRest.paramDecorators = [
      ...newRest.paramDecorators,
      ...from.paramDecorators,
    ];
  }

  return newRest;
}
