import * as ts from 'typescript';
import {
  GenerationContext,
  Usecase,
  UsecaseMethod,
  UsecaseParam,
} from './types';
import { isPrimitiveType } from './util/type';

export class UsecaseParser {
  checker: ts.TypeChecker;

  genContext: GenerationContext;

  constructor() {
    this.genContext = {
      usecases: [],
      deps: [],
    };
  }

  parse(filenames: string[]): GenerationContext {
    const program = ts.createProgram(filenames, {});
    this.checker = program.getTypeChecker();
    program.getSourceFiles().forEach((srcFile) => {
      srcFile.forEachChild((child) => {
        if (ts.isInterfaceDeclaration(child)) {
          const comment = this.getLeadingComment(child.getFullText(srcFile));
          if (comment && comment.includes('@TscaUsecase')) {
            this.parseTscaUsecase(child);
          }
        }
      });
    });

    return this.genContext;
  }

  private addUsecase(name: string): Usecase {
    if (this.genContext.usecases.find((u) => u.name === name)) {
      throw new Error(`Found duplicated usecase ${name}`);
    }
    const u: Usecase = {
      name,
      methods: [],
    };
    this.genContext.usecases.push(u);
    return u;
  }

  private addDepUsecaseParam(param: UsecaseParam): void {
    this.genContext.deps.push(param);
  }

  private getDepUsecaseParamByTypeName(typeName: string): UsecaseParam | null {
    return this.genContext.deps.find((dep) => dep.name === typeName);
  }

  private isDepUsecaseParamExist(typeName: string): boolean {
    return !!this.getDepUsecaseParamByTypeName(typeName);
  }

  private addMethodToUsecase(
    uName: string,
    methodName: string,
    requestType: string,
    responseType: string,
  ): UsecaseMethod {
    const u = this.genContext.usecases.find((u) => u.name === uName);
    if (!u) {
      throw new Error(`Cannot find usecase ${uName}`);
    }

    if (u.methods.find((m) => m.name === methodName)) {
      throw new Error(
        `Found duplicated methold ${methodName} in Usecase ${uName}`,
      );
    }
    const m: UsecaseMethod = {
      name: methodName,
      requestType,
      responseType,
    };
    u.methods.push(m);
    return m;
  }

  private getLeadingComment(nodeText: string): string {
    const commentRanges = ts.getLeadingCommentRanges(nodeText, 0);
    if (commentRanges && commentRanges.length) {
      const commentStrings: string[] = commentRanges.map((r) =>
        nodeText.slice(r.pos, r.end),
      );
      return commentStrings.reduce((prev, curr) => prev + curr, '');
    }
    return null;
  }

  private parseTscaUsecase(node: ts.InterfaceDeclaration) {
    const usecaseName = node.name.getText(node.getSourceFile());
    this.addUsecase(usecaseName);

    node.members.filter(ts.isMethodSignature).forEach((member) => {
      this.parseTscaUsecaseMethod(member, usecaseName);
    });
  }

  private parseTscaUsecaseMethod(
    node: ts.MethodSignature,
    usecaseName: string,
  ) {
    const methodName = node.name.getText(node.getSourceFile());
    const retType = this.parseUsecaseMethodReqOrRes(
      usecaseName,
      methodName,
      node.type,
      false,
    );
    if (node.parameters.length > 1) {
      throw new Error(
        `Expected only 1 parameter for method ${methodName} in ${usecaseName}`,
      );
    }
    let paramType: UsecaseParam;
    node.parameters.forEach((param) => {
      paramType = this.parseUsecaseMethodReqOrRes(
        usecaseName,
        methodName,
        param.type,
        true,
      );
    });

    this.addMethodToUsecase(
      usecaseName,
      methodName,
      paramType.type,
      retType.type,
    );
  }

  private parseUsecaseMethodReqOrRes(
    usecaseName: string,
    usecaseMethod: string,
    node: ts.TypeNode,
    isUsecaseRequest: boolean,
  ): UsecaseParam {
    const type = this.checker.getTypeAtLocation(node);
    const typeStr = this.checker.typeToString(type);
    if (isPrimitiveType(typeStr)) {
      throw new Error(
        `${usecaseName}->${usecaseMethod}'s ${
          isUsecaseRequest ? 'request' : 'response'
        }'s type should be a interface`,
      );
    }
    return this.addDepUsecaseParamFromType(type);
  }

  private addDepUsecaseParamFromType(type: ts.Type): UsecaseParam {
    const typeStr = this.checker.typeToString(type);
    if (isPrimitiveType(typeStr)) {
      throw new Error(
        `Only interface can be added as UsecaeParam, got ${typeStr}`,
      );
    }
    if (!this.isDepUsecaseParamExist(typeStr)) {
      const up = this.usecaseParamFromType(type);
      this.addDepUsecaseParam(up);
      return up;
    } else {
      return this.getDepUsecaseParamByTypeName(typeStr);
    }
  }

  private usecaseParamFromType(type: ts.Type): UsecaseParam {
    const symbol = type.symbol;
    const decls = symbol.declarations.filter(ts.isInterfaceDeclaration);
    if (!decls) {
      throw new Error(`Expect type ${symbol.name} to be defined as interface`);
    }
    if (decls.length !== 1) {
      throw new Error(`Expect type ${symbol.name} to be defined only once`);
    }
    const decl = decls[0];
    const tp: UsecaseParam = {
      type: symbol.name,
    };

    if (!isPrimitiveType(symbol.name)) {
      const children: UsecaseParam[] = decl.members.map((member) => {
        if (!ts.isPropertySignature(member)) {
          throw new Error(
            `${symbol.name} only allow property signature, ${member.name} is not`,
          );
        }
        const childType = this.checker.getTypeAtLocation(member.type);
        const childTypeStr = this.checker.typeToString(childType);
        const childUp: UsecaseParam = {
          name: member.name.getText(decl.getSourceFile()),
          type: childTypeStr,
          optional: !!member.questionToken,
        };

        if (!isPrimitiveType(childTypeStr)) {
          this.addDepUsecaseParamFromType(childType);
        }

        return childUp;
      });
      tp.children = children;

      if (decl.heritageClauses) {
        decl.heritageClauses.forEach((hc) => {
          hc.types.forEach((t) => {
            const inherittedType = this.checker.getTypeAtLocation(t.expression);
            const up = this.usecaseParamFromType(inherittedType);
            tp.children = [...tp.children, ...up.children];
          });
        });
      }
    }

    return tp;
  }
}
