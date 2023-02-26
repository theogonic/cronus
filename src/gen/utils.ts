import { GContext } from '../context';
import { TscaMethod, TscaSchema } from '../types';
import * as ts from 'typescript';

const PrimitiveTypes = [
  'string',
  'number',
  'bigint',
  'boolean',
  'bool',
  'integer',
  'array',
  'float',
  'int32',
  'i32',
];

export function isPrimitiveType(type: string): boolean {
  return PrimitiveTypes.includes(type);
}

export function isTypeNumber(type: string): boolean {
  return (
    type == 'number' ||
    type == 'integer' ||
    type == 'i32' ||
    type == 'int32' ||
    type == 'float'
  );
}

export function isTypeBoolean(type: string): boolean {
  return type == 'boolean' || type == 'bool';
}

export function getKeywordType(type: string): ts.KeywordTypeSyntaxKind {
  if (isTypeNumber(type)) {
    return ts.SyntaxKind.NumberKeyword;
  } else if (isTypeBoolean(type)) {
    return ts.SyntaxKind.BooleanKeyword;
  } else if (type == 'string') {
    return ts.SyntaxKind.StringKeyword;
  }

  throw new Error(`unsupported type ${type}`);
}

export function getTsTypeConstructor(type: string): string {
  if (isTypeNumber(type)) {
    return 'Number';
  } else if (isTypeBoolean(type)) {
    return 'Boolean';
  } else if (type == 'string') {
    return 'String';
  }

  throw new Error(`unsupported type ${type}`);
}
/**
 * parseRestPathVars find all variables in the given URL path
 * @param restPath Restful URL path template
 * Ex. user/:id/profile/:prop => [id, prop]
 */
export function parseRestPathVars(restPath: string): string[] {
  if (!restPath) {
    return [];
  }
  return restPath
    .split('/')
    .filter((s) => s.startsWith(':'))
    .map((s) => s.substr(1));
}

export function getTscaMethodRestBodyPropNames(
  ctx: GContext,
  method: TscaMethod,
): string[] {
  const pathVars = parseRestPathVars(method.gen?.rest.path);
  const queryVars = getTscaMethodQueryVars(ctx, method, false) || [];
  const req = method.req.properties;
  const queryVarsTop = queryVars.map((q) => q[0]);
  return req
    .filter((r) => !queryVarsTop.includes(r.name) && !pathVars.includes(r.name))
    .map((schema) => schema.name);
}

export function getTscaMethodQueryVars(
  ctx: GContext,
  m: TscaMethod,
  flat: boolean,
): string[][] {
  if (!m.gen?.rest) {
    return null;
  }
  if (m.gen.rest.method != 'get') {
    return null;
  }
  const queryVars = m.gen.rest.query;
  let queryVarSchemas: TscaSchema[] = null;
  if (queryVars) {
    // if only part of properties should used for query
    queryVarSchemas = m.gen.rest.query.map((q) => m.req.getPropByName(q));
  } else {
    // filter out request properties used in path
    const pathVars = parseRestPathVars(m.gen.rest.path);
    const req = m.req.properties;
    queryVarSchemas = req.filter((r) => !pathVars.includes(r.name));
  }

  if (!flat) {
    return queryVarSchemas.map((schema) => [schema.name]);
  }

  return queryVarSchemas
    .map((schema) =>
      getFlatternPropertiesOfTscaSchema(ctx, schema, [schema.name]),
    )
    .reduce((prev, curr) => prev.concat(curr), []);
}

export function getFlatternPropertiesOfTscaSchema(
  ctx: GContext,
  schema: TscaSchema,
  parentPathes: string[] = [],
): string[][] {
  const properties: string[][] = [];

  let childSchemas: TscaSchema[] = null;
  if (schema.type) {
    if (
      isPrimitiveType(schema.type) ||
      schema.type == 'array' ||
      ctx.isTypeEnum(schema.type)
    ) {
      return [parentPathes];
    }
    const actualSchema = ctx.getTypeSchemaByName(schema.type);
    childSchemas = actualSchema.properties;
  } else {
    childSchemas = schema.properties;
  }

  if (!childSchemas) {
    return [];
  }

  for (const prop of childSchemas) {
    if (
      isPrimitiveType(prop.type) ||
      prop.type == 'array' ||
      ctx.isTypeEnum(prop.type)
    ) {
      properties.push([...parentPathes, prop.name]);
    } else {
      properties.push(
        ...getFlatternPropertiesOfTscaSchema(ctx, prop, [
          ...parentPathes,
          prop.name,
        ]),
      );
    }
  }

  return properties;
}

export function getPropByFlatternProp(
  ctx: GContext,
  schema: TscaSchema,
  flatternProp: string[],
): TscaSchema {
  if (!flatternProp) {
    throw new Error('no flattern prop to read');
  }

  const cs = schema.getPropByName(flatternProp[0]);
  if (flatternProp.length == 1) {
    return cs;
  }
  const actualChildSchema = ctx.getTypeSchemaByName(cs.type);
  return getPropByFlatternProp(ctx, actualChildSchema, flatternProp.slice(1));
}

export function getNameOfFlatternProp(f: string[]): string {
  if (f.length == 1) {
    return f[0];
  }
  return (
    f
      .slice(undefined, f.length - 1)
      .map((s) => s[0])
      .join('_') +
    '_' +
    f[f.length - 1]
  );
}
