import { TscaMethod } from '../types';

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

export function getTscaMethodRestBodyPropNames(method: TscaMethod): string[] {
  const pathVars = parseRestPathVars(method.gen?.rest.path);
  const queryVars = method.gen?.rest.query || [];
  const req = method.req.properties;
  return req
    .filter((r) => !queryVars.includes(r.name) && !pathVars.includes(r.name))
    .map((schema) => schema.name);
}
