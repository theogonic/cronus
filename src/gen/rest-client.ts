import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaSchema, TscaUsecase } from '../types';
import { Register } from '../decorators';
import { Generator } from './base';
import { isPrimitiveType } from './utils';
import * as ts from 'typescript';
import * as _ from 'lodash';
import { BaseGeneratorConfig } from '../config';

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
            [
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier('url'),
                ts.factory.createTemplateExpression(
                  ts.factory.createTemplateHead('aa/', 'aa/'),
                  [
                    ts.factory.createTemplateSpan(
                      ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier('request'),
                        ts.factory.createIdentifier('userId'),
                      ),
                      ts.factory.createTemplateTail('', ''),
                    ),
                  ],
                ),
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier('method'),
                ts.factory.createStringLiteral(m.gen.rest.method),
              ),
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier('data'),
                ts.factory.createObjectLiteralExpression([], false),
              ),
            ],
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
