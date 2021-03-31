import { Usecase, UsecaseParam } from './types';
import * as ts from 'typescript';

export abstract class UsecaseGenerator {
  public abstract genTsUsecaseParam(upt: UsecaseParam): ts.Node;
  public abstract genTsUsecase(u: Usecase): ts.Node;
}
