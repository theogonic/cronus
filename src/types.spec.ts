import * as yaml from 'js-yaml';
import { RawTscaDef, TscaDef } from './types';

describe('TscaDef', () => {
  it('add def only type happy', () => {
    const content = `
types:
  User:
    properties:
      id:
        type: string
    
    `;
    const rawTscaDef = yaml.load(content) as RawTscaDef;
    const tscaDef = TscaDef.fromRaw(rawTscaDef, {
      src: 'abc.yaml',
    });
    expect(tscaDef.types.length).toBe(1);
    expect(tscaDef.usecases.length).toBe(0);
    expect(tscaDef.src).toBe('abc.yaml');
    const types = tscaDef.types[0];
    expect(types.name).toBe('User');
    expect(types.properties[0].type).toBe('string');
    expect(types.properties[0].name).toBe('id');
  });

  it('add def only usecases happy', () => {
    const content = `
usecases:
  user:
    methods:
      createUser:
        req: 
          properties:
            name:
              type: string
        res: 
          properties:
            id:
              type: string
    `;

    const rawTscaDef = yaml.load(content) as RawTscaDef;
    const tscaDef = TscaDef.fromRaw(rawTscaDef, { src: 'abc.yaml' });

    expect(tscaDef.types.length).toBe(0);
    expect(tscaDef.usecases.length).toBe(1);

    const usecase = tscaDef.usecases[0];
    expect(usecase.name).toBe('user');

    expect(usecase.methods.length).toBe(1);
    const method = usecase.methods[0];
    expect(method.name).toBe('createUser');
    expect(method.req.properties.length).toBe(1);
    expect(method.res.properties.length).toBe(1);
    expect(method.req.properties[0].name).toBe('name');
    expect(method.res.properties[0].name).toBe('id');
  });
});
