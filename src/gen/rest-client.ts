import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaUsecase } from '../types';
import { Register } from '../decorators';
import { Generator } from './base';
import * as ts from 'typescript';
import * as _ from 'lodash';
import { BaseGeneratorConfig } from '../config';

interface RestClientGeneratorConfig extends BaseGeneratorConfig {
  tsTypeImport: string;
}

@Register('rest-client')
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

  private getRestClientMethod(
    ctx: GContext,
    m: TscaMethod,
  ): ts.MethodDeclaration {
    return ts.factory.createMethodDeclaration(
      undefined,
      undefined,
      undefined,
      ts.factory.createIdentifier('getUser'),
      undefined,
      undefined,
      [],
      undefined,
      ts.factory.createBlock(
        [
          ts.factory.createExpressionStatement(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                ts.factory.createIdentifier('instance'),
              ),
              ts.factory.createIdentifier(''),
            ),
          ),
        ],
        true,
      ),
    );
  }

  private getRestClientClassName(u: TscaUsecase): string {
    return this.getUsecaseTypeName(u) + 'RestClient';
  }

  private getRestClient(ctx: GContext, u: TscaUsecase): ts.ClassDeclaration {
    const interfaceName = this.getUsecaseTypeName(u);
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
      [],
    );
  }
}
