import { Generator } from './base';
import { TscaDef } from '../types';
import { GContext } from '../context';
import { Register } from '../decorators';

@Register('gql-nestjs')
export class GraphQLNestjsTsDefGenerator extends Generator {
  public before(ctx: GContext) {
    ctx;
  }
  public after(ctx: GContext) {
    ctx;
  }
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    ctx;
  }
}
