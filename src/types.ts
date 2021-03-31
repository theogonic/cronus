export type RawTscaUsecase = Record<string, RawTscaMethod>;

export interface RawTscaMethodRest {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  query?: string[];
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
  req: RawTscaSchema;
  res: RawTscaSchema;
}

export interface RawTscaSchemaGql {
  // special graphql type, like ID, Float, or other custom scalar
  type: string;
}

interface TscaSchemaGen {
  gql?: RawTscaSchemaGql;
  'general-entity': {};
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
  srcFile: string;
}

abstract class BaseTscaDefComponent {
  public readonly srcFile: string;
  public readonly name: string;
  constructor(prop: BaseTscaDefProp) {
    this.srcFile = prop.srcFile;
    this.name = prop.name;
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
        const child = TscaSchema.fromRaw(
          t,
          {
            srcFile: prop.srcFile,
            name,
          },
          null,
        );
        def.types.push(child);
      }
    }

    for (const name in usecases) {
      if (Object.prototype.hasOwnProperty.call(usecases, name)) {
        const usecase = usecases[name];
        const child = TscaUsecase.fromRaw(usecase, {
          srcFile: prop.srcFile,
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

  static fromRaw(raw: RawTscaUsecase, prop: BaseTscaDefProp): TscaUsecase {
    const u = new TscaUsecase(prop);
    for (const metholdName in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, metholdName)) {
        const rawMethod = raw[metholdName];
        const method = TscaMethod.fromRaw(rawMethod, {
          srcFile: prop.srcFile,
          name: metholdName,
        });
        u.methods.push(method);
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
  parent?: TscaSchema;
  getPropByName(name: string): TscaSchema {
    const prop = this.properties?.find((prop) => prop.name === name);
    if (!prop) {
      throw new Error(`cannot find '${name}' in properties of '${this.type}'`);
    }
    return prop;
  }
  static fromRaw(
    raw: RawTscaSchema,
    prop: BaseTscaDefProp,
    parent: TscaSchema,
  ): TscaSchema {
    const { properties, type, namespace, items, required, gen } = raw;
    const schema = new TscaSchema(prop);
    schema.type = type;
    schema.enum = raw['enum'];
    schema.namespace = namespace;
    schema.required = required;
    schema.parent = parent;
    if (items) {
      schema.items = TscaSchema.fromRaw(
        items,
        {
          srcFile: prop.srcFile,
          name: '',
        },
        schema,
      );
    }
    schema.gen = gen;

    if (properties) {
      for (const propName in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, propName)) {
          const childSchema = TscaSchema.fromRaw(
            properties[propName],
            {
              srcFile: prop.srcFile,
              name: propName,
            },
            schema,
          );

          schema.properties.push(childSchema);
        }
      }
    }

    return schema;
  }
}

export class TscaMethod extends BaseTscaDefComponent {
  gen?: TscaMethodGen;
  gql?: any;
  req: TscaSchema;
  res: TscaSchema;

  static fromRaw(raw: RawTscaMethod, prop: BaseTscaDefProp): TscaMethod {
    const method = new TscaMethod(prop);
    method.req = TscaSchema.fromRaw(
      raw.req,
      {
        srcFile: prop.srcFile,
        name: '',
      },
      null,
    );

    method.res = TscaSchema.fromRaw(
      raw.res,
      {
        srcFile: prop.srcFile,
        name: '',
      },
      null,
    );

    method.gen = raw.gen;

    return method;
  }
}
