import { UsecaseGenerator } from './base';
import * as ts from 'typescript';
import { Usecase, UsecaseParam } from './types';

export class GraphQLUsecaseGenerator extends UsecaseGenerator {
  public genTsUsecaseParam(upt: UsecaseParam): ts.Node {
    return null;
  }
  public genTsUsecase(u: Usecase): ts.Node {
    return null;
  }
}
