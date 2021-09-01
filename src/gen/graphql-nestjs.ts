import { Generator } from './base';
import { TscaDef } from '../types';
import { GContext } from '../context';
import { Register } from '../decorators';

@Register('gql-nestjs')
export class GraphQLNestjsTsDefGenerator extends Generator {
  public before(ctx: GContext) {}
  public after(ctx: GContext) {}
  protected genTscaDef(content: GContext, def: TscaDef) {}
}
