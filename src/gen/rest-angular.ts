import { BaseGeneratorConfig } from '../config';
import { GContext } from '../context';
import { Register } from '../decorators';
import { TscaDef } from '../types';
import { Generator } from './base';

@Register('rest_angular')
export class RestAngularGenerator extends Generator<BaseGeneratorConfig> {
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    throw new Error('Method not implemented.');
  }
  public before(ctx: GContext) {
    throw new Error('Method not implemented.');
  }
  public after(ctx: GContext) {
    throw new Error('Method not implemented.');
  }
}
