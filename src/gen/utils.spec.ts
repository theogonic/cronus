import { GContext } from '../context';
import { TscaSchema } from '../types';
import { getFlatternPropertiesOfTscaSchema } from './utils';

describe('utils', () => {
  it('getFlatternPropertiesOfTscaSchema', () => {
    const ctx = new GContext(null);
    ctx.types['ABCDE'] = TscaSchema.fromRaw(
      {
        properties: {
          aa: {
            type: 'bool',
          },
          bb: {
            type: 'string',
          },
        },
      },
      {
        src: '',
      },
    );
    const tscaSchema = TscaSchema.fromRaw(
      {
        properties: {
          a: {
            type: 'string',
          },
          b: {
            type: 'bool',
          },
          c: {
            type: 'array',
            items: {
              type: 'int32',
            },
          },
          d: {
            type: 'ABCDE',
          },
        },
      },
      {
        src: '',
      },
    );

    const flatternProps = getFlatternPropertiesOfTscaSchema(ctx, tscaSchema);

    expect(flatternProps.length).toBe(5);
    expect(flatternProps).toContainEqual(['a']);
    expect(flatternProps).toContainEqual(['b']);
    expect(flatternProps).toContainEqual(['c']);
    expect(flatternProps).toContainEqual(['d', 'aa']);

    expect(flatternProps).toContainEqual(['d', 'bb']);
  });
});
