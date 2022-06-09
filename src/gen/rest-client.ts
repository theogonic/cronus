import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaMethodGen, TscaUsecase } from '../types';
import { Register } from '../decorators';
import { Generator } from './base';
import * as ts from 'typescript';
import * as _ from 'lodash';
import { BaseGeneratorConfig } from '../config';
import { getTscaMethodRestBodyPropNames, parseRestPathVars } from './utils';

interface RestClientGeneratorConfig extends BaseGeneratorConfig {
  tsTypeImport: string;
}

@Register('rest_client')
export class RestClientGenerator extends Generator<RestClientGeneratorConfig> {
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    const classes = def.usecases.map((u) => this.getRestClient(ctx, u));
    ctx.addNodesToTsFile(this.output, ...classes);
  }
  public before(ctx: GContext) {
    ctx.addImportsToTsFile(this.output, {
      from: 'axios',
      default: 'axios',
      items: ['AxiosInstance', 'AxiosRequestConfig'],
    });
    const baseClientNode = this.getBaseRestClient();

    ctx.addNodesToTsFile(this.output, baseClientNode);
  }
  public after(ctx: GContext) {}

  private getBaseRestClient(): ts.ClassDeclaration {
    return ts.factory.createClassDeclaration(
      undefined,
      [
        ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
        ts.factory.createModifier(ts.SyntaxKind.AbstractKeyword),
      ],
      ts.factory.createIdentifier('BaseRestClient'),
      undefined,
      undefined,
      [
        ts.factory.createPropertyDeclaration(
          undefined,
          [ts.factory.createModifier(ts.SyntaxKind.ProtectedKeyword)],
          ts.factory.createIdentifier('instance'),
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier('AxiosInstance'),
            undefined,
          ),
          undefined,
        ),
        ts.factory.createConstructorDeclaration(
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              ts.factory.createIdentifier('config'),
              undefined,
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier('AxiosRequestConfig'),
                undefined,
              ),
              undefined,
            ),
          ],
          ts.factory.createBlock(
            [
              ts.factory.createExpressionStatement(
                ts.factory.createBinaryExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createThis(),
                    ts.factory.createIdentifier('instance'),
                  ),
                  ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                  ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                      ts.factory.createIdentifier('axios'),
                      ts.factory.createIdentifier('create'),
                    ),
                    undefined,
                    [ts.factory.createIdentifier('config')],
                  ),
                ),
              ),
            ],
            true,
          ),
        ),
      ],
    );
  }

  private getRestClientClassName(u: TscaUsecase): string {
    return this.getUsecaseTypeName(u) + 'RestClient';
  }

  private genTscaMethodBlock(
    ctx: GContext,
    u: TscaUsecase,
    m: TscaMethod,
  ): ts.Statement[] {
    const stmts: ts.Statement[] = [];

    if (!m.gen.rest) {
      stmts.push(
        ts.factory.createThrowStatement(
          ts.factory.createNewExpression(
            ts.factory.createIdentifier('Error'),
            undefined,
            [
              ts.factory.createStringLiteral(
                'this method does not have rest generation setting in zeus definition.',
              ),
            ],
          ),
        ),
      );
      return stmts;
    }
    const axiosCfgObjLiteralProps: ts.ObjectLiteralElementLike[] = [
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier('url'),
        getTemplateExprForGenRest(m.gen.rest.path, 'request'),
      ),
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier('method'),
        ts.factory.createStringLiteral(m.gen.rest.method),
      ),
    ];

    if (m.gen.rest.method != 'get') {
      axiosCfgObjLiteralProps.push(
        ts.factory.createShorthandPropertyAssignment(
          ts.factory.createIdentifier('data'),
          undefined,
        ),
      );

      stmts.push(this.genDataVarStmt(ctx, m, 'request'));
    } else {
      if (m.gen.rest.query && m.gen.rest.query.length > 0) {
        axiosCfgObjLiteralProps.push(
          ts.factory.createShorthandPropertyAssignment(
            ts.factory.createIdentifier('params'),
            undefined,
          ),
        );

        stmts.push(this.genParamsVarStmt(m, 'request'));
      }
    }

    const axiosReqCallStmt = ts.factory.createAwaitExpression(
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createThis(),
            ts.factory.createIdentifier('instance'),
          ),
          ts.factory.createIdentifier('request'),
        ),
        undefined,
        [
          ts.factory.createObjectLiteralExpression(
            axiosCfgObjLiteralProps,
            true,
          ),
        ],
      ),
    );
    const resStmt = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier('res'),
            undefined,
            undefined,
            axiosReqCallStmt,
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    const retStmt = ts.factory.createReturnStatement(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier('res'),
        ts.factory.createIdentifier('data'),
      ),
    );

    stmts.push(resStmt);
    stmts.push(retStmt);

    return stmts;
  }

  private genParamsVarStmt(m: TscaMethod, reqObjName: string): ts.Statement {
    const propAssigns = m.gen.rest.query.map((prop) =>
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier(prop),
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(reqObjName),
          ts.factory.createIdentifier(prop),
        ),
      ),
    );
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier('params'),
            undefined,
            undefined,
            ts.factory.createObjectLiteralExpression(propAssigns, true),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  private genDataVarStmt(
    ctx: GContext,
    m: TscaMethod,
    reqObjName: string,
  ): ts.Statement {
    // filter out properties mentioned in path, query
    const bodyProps = getTscaMethodRestBodyPropNames(ctx, m);
    const propAssigns = bodyProps.map((prop) =>
      ts.factory.createPropertyAssignment(
        ts.factory.createIdentifier(prop),
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier(reqObjName),
          ts.factory.createIdentifier(prop),
        ),
      ),
    );
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier('data'),
            undefined,
            undefined,
            ts.factory.createObjectLiteralExpression(propAssigns, true),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );
  }

  // Generate REST implementations of defined method interface
  private genTscaMethod(
    ctx: GContext,
    u: TscaUsecase,
    m: TscaMethod,
  ): ts.MethodDeclaration {
    const reqTypeName = this.getTscaMethodRequestTypeName(m);
    const resTypeName = this.getTscaMethodResponseTypeName(m);

    // Add imports of method request types
    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [reqTypeName, resTypeName],
    });

    return ts.factory.createMethodDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      ts.factory.createIdentifier(m.name),
      undefined,
      undefined,
      [
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          undefined,
          ts.factory.createIdentifier('request'),
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(this.getTscaMethodRequestTypeName(m)),
            undefined,
          ),
          undefined,
        ),
      ],
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('Promise'),
        [
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(this.getTscaMethodResponseTypeName(m)),
            undefined,
          ),
        ],
      ),
      ts.factory.createBlock(this.genTscaMethodBlock(ctx, u, m), true),
    );
  }

  private getRestClient(ctx: GContext, u: TscaUsecase): ts.ClassDeclaration {
    const interfaceName = this.getUsecaseTypeName(u);

    const methodNodes = u.methods.map((m) => this.genTscaMethod(ctx, u, m));

    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [interfaceName],
    });

    return ts.factory.createClassDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      this.getRestClientClassName(u),
      undefined,
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createIdentifier('BaseRestClient'),
            undefined,
          ),
        ]),
        ts.factory.createHeritageClause(ts.SyntaxKind.ImplementsKeyword, [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createIdentifier(interfaceName),
            undefined,
          ),
        ]),
      ],
      [...methodNodes],
    );
  }
}

/**
 *
 * @param path template URL such as "user/:userId" and "users?a={a}"
 * @param requestObjName request's object/param name
 * @returns TemplateExpression
 */
export function getTemplateExprForGenRest(
  path: string,
  requestObjName: string,
): ts.Expression {
  let leftIdx = 0;
  let tempHead = null;
  const templateSpans: ts.TemplateSpan[] = [];

  while (leftIdx < path.length) {
    const idx = path.indexOf(':', leftIdx);
    if (idx != -1) {
      // found a ':'

      let slashIdx = path.indexOf('/', idx);
      if (slashIdx == -1) {
        slashIdx = path.length;
      }
      const reqProp = path.substring(idx + 1, slashIdx);

      if (leftIdx == 0 && idx != 0) {
        // set template head if there are chars before first ':'
        tempHead = path.substring(leftIdx, idx);
      }

      const propAccessExpr = ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier(requestObjName),
        ts.factory.createIdentifier(reqProp),
      );
      // try to find next ':'
      const nextIdx = path.indexOf(':', idx + 1);
      if (nextIdx == -1) {
        // if there is no next, all rest of chars can be placed at tail
        templateSpans.push(
          ts.factory.createTemplateSpan(
            propAccessExpr,
            ts.factory.createTemplateTail(path.substring(slashIdx)),
          ),
        );
        break;
      } else {
        // there is a next, all chars before next can be placed in tail
        templateSpans.push(
          ts.factory.createTemplateSpan(
            propAccessExpr,
            ts.factory.createTemplateMiddle(path.substring(slashIdx, nextIdx)),
          ),
        );

        leftIdx = nextIdx;
      }
    } else {
      if (leftIdx == 0) {
        // does not found ':' at the beginning
        return ts.factory.createNoSubstitutionTemplateLiteral(path);
      }
    }
  }
  return ts.factory.createTemplateExpression(
    ts.factory.createTemplateHead(tempHead ? tempHead : ''),
    templateSpans,
  );
}
