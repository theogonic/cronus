import * as yaml from 'js-yaml';
import { RawTscaDef, TscaDef } from './types';

describe('TscaDef', () => {
  it('add def only schema happy', () => {
    const content = `
schemas:
  HelloRequest:
    properties:
      id:
        type: string
    
    `;
    const rawTscaDef = yaml.load(content) as RawTscaDef;
    const tscaDef = new TscaDef('abc.yaml', '', rawTscaDef);
    expect(tscaDef.schemas.length).toBe(1);
    expect(tscaDef.usecases.length).toBe(0);

    const schema = tscaDef.schemas[0];
    expect(schema.name).toBe('HelloRequest');
    expect(schema.properties[0].type).toBe('string');
    expect(schema.properties[0].name).toBe('id');
  });

  it('add def only usecases happy', () => {
    const content = `
usecases:
  user:
    createUser:
      req: UserRequest
      res: UserResponse
      rest: 'user/:id'
      gql:
    `;

    const rawTscaDef = yaml.load(content) as RawTscaDef;
    const tscaDef = new TscaDef('abc.yaml', '', rawTscaDef);

    expect(tscaDef.schemas.length).toBe(0);
    expect(tscaDef.usecases.length).toBe(1);

    const usecase = tscaDef.usecases[0];
    expect(usecase.name).toBe('user');

    expect(usecase.methods.length).toBe(1);
    const method = usecase.methods[0];
    expect(method.name).toBe('createUser');
    expect(method.req).toBe('UserRequest');
    expect(method.res).toBe('UserResponse');
  });
});
