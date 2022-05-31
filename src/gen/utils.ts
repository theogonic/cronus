const PrimitiveTypes = [
  'string',
  'number',
  'bigint',
  'boolean',
  'bool',
  'integer',
  'array',
  'float',
];

export function isPrimitiveType(type: string): boolean {
  return PrimitiveTypes.includes(type);
}
