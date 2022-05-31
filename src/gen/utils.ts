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
