import { UsecaseGenerator } from './base';
import * as ts from 'typescript';
import { UsecaseParam, Usecase } from './types';

export class RestNestjsUsecaseGenerator extends UsecaseGenerator {
  /**
   * Generate a Nestjs DTO for the given UsecaseParamType
   * Examples:
   * export class CreateCatDto {
        @ApiProperty()
        name: string;

        @ApiProperty()
        age: number;

        @ApiProperty()
        breed: string;
    }
   * @param upt UsecaseParamType 
   * @returns Typescript AST Node
   */
  public genTsUsecaseParam(upt: UsecaseParam): ts.Node {
    const members: ts.ClassElement[] = [];
    upt.children.forEach((child) => {
      const pn = ts.factory.createPropertyDeclaration(
        null,
        null,
        child.name,
        null,
        null,
        null,
      );
      members.push(pn);
    });

    return ts.factory.createClassDeclaration(
      null,
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(upt.name),
      null,
      null,
      members,
    );
  }
  public genTsUsecase(u: Usecase): ts.Node {
    return null;
  }
}
