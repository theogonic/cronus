const PrimitiveTypes = [
  'string',
  'number',
  'bigint',
  'boolean',
  'integer',
  'array',
];

export function isPrimitiveType(type: string): boolean {
  return PrimitiveTypes.includes(type);
}
