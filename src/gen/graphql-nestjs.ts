import { Generator } from './base';
import { TscaDef } from '../types';
import { GContext } from '../context';
import { Register } from '../decorators';

@Register('gql-nestjs')
export class GraphQLNestjsTsDefGenerator extends Generator {
  protected genTscaDef(content: GContext, def: TscaDef) {}
}
