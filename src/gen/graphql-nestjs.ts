import * as ts from 'typescript';
import { GContext } from '../context';
import { Register } from '../decorators';
import { TscaDef, TscaMethod, TscaSchema, TscaUsecase } from '../types';
import * as _ from 'lodash';
import { Generator } from './base';
import { BaseGeneratorConfig } from 'src/config';

interface GraphQLResolverGeneratorConfig extends BaseGeneratorConfig {
  tsTypeImport: string;
}

@Register('gql_nestjs')
export class GraphQLNestJsGenerator extends Generator<GraphQLResolverGeneratorConfig> {
  public before(ctx: GContext) {
    ctx.addImportsToTsFile(
      this.output,
      {
        from: '@nestjs/common',
        items: ['Inject', 'Logger'],
      },
      {
        from: '@nestjs/graphql',
        items: [
          'Args',
          'Context',
          'Mutation',
          'Parent',
          'Query',
          'ResolveField',
          'Resolver',
          'ResolveReference',
        ],
      },
    );
  }
  public after(ctx: GContext) {
    ctx;
  }
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    // Generate resolver for queries
    // TODO: Support string field for '@Resolver()' decorator

    // Build a `method_name`Resolver for each usecase that contains Resolver generator
    def.usecases
      .filter((u) => u.gen?.gql_resolver !== undefined)
      .forEach((u) => this.genTscaUsecase(ctx, u));

    // filter type has enum child
    def.types
      .filter((s) => {
        if (s.properties) {
          for (const prop of s.properties) {
            if (prop.type && ctx.isTypeHasEnumChild(prop.type)) {
              return true;
            } else if (
              prop.type == 'array' &&
              ctx.isTypeHasEnumChild(prop.items.type)
            ) {
              return true;
            }
          }
        }
        return false;
      })
      .forEach((s) => this.genTscaSchemaWithChildEnum(ctx, s));
  }

  private genTscaSchemaWithChildEnum(ctx: GContext, schema: TscaSchema) {
    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [schema.name],
    });
    const helperClass = ts.factory.createClassDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      this.getGqlTypeNameFromName(schema.name),
      undefined,
      undefined,
      [
        ts.factory.createMethodDeclaration(
          undefined,
          [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
          undefined,
          ts.factory.createIdentifier('toRaw'),
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              ts.factory.createIdentifier('gqlObj'),
              undefined,
              undefined,
              undefined,
            ),
          ],
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(schema.name),
            undefined,
          ),
          this.genRawSerialorDeserialMethodBodyForGql(
            ctx,
            schema,
            'gqlObj',
            'toRaw',
            ts.SyntaxKind.StringKeyword,
          ),
        ),
        ts.factory.createMethodDeclaration(
          undefined,
          [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
          undefined,
          ts.factory.createIdentifier('fromRaw'),
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              ts.factory.createIdentifier('raw'),
              undefined,
              undefined,
              undefined,
            ),
          ],
          undefined,
          this.genRawSerialorDeserialMethodBodyForGql(
            ctx,
            schema,
            'raw',
            'fromRaw',
            ts.SyntaxKind.NumberKeyword,
          ),
        ),
      ],
    );

    ctx.addNodesToTsFile(this.output, helperClass);
  }

  genRawSerialorDeserialMethodBodyForGql(
    ctx: GContext,
    schema: TscaSchema,
    rawVarName = 'raw',
    methodForTypeWithChildEnum: string,
    actualEnumType: ts.SyntaxKind.StringKeyword | ts.SyntaxKind.NumberKeyword,
  ): ts.Block {
    const literals: ts.ObjectLiteralElementLike[] = [];

    for (const prop of schema.properties) {
      let node: ts.ObjectLiteralElementLike = null;
      const propIdent = ts.factory.createIdentifier(
        `${rawVarName}.${prop.name}`,
      );
      if (prop.type && ctx.isTypeEnum(prop.type)) {
        // do serialization/deserilization
        node = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(prop.name),
          ts.factory.createElementAccessExpression(
            ts.factory.createIdentifier(prop.type),
            ts.factory.createAsExpression(
              propIdent,
              ts.factory.createKeywordTypeNode(actualEnumType),
            ),
          ),
        );

        ctx.addImportsToTsFile(this.output, {
          from: this.config.tsTypeImport,
          items: [prop.type],
        });
      } else if (prop.type && ctx.isTypeHasEnumChild(prop.type)) {
        // call this type's fromRaw/toRaw
        node = ts.factory.createPropertyAssignment(
          prop.name,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(
                this.getGqlTypeNameFromName(prop.type),
              ),
              methodForTypeWithChildEnum,
            ),
            undefined,
            [propIdent],
          ),
        );
        ctx.addImportsToTsFile(this.output, {
          from: this.config.tsTypeImport,
          items: [prop.type],
        });
      } else if (prop.type == 'array' && ctx.isTypeEnum(prop.items.type)) {
        // the array of enum
        node = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(prop.name),
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createParenthesizedExpression(
                ts.factory.createBinaryExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(rawVarName),
                    ts.factory.createIdentifier(prop.name),
                  ),
                  ts.factory.createToken(ts.SyntaxKind.BarBarToken),
                  ts.factory.createArrayLiteralExpression([], false),
                ),
              ),
              ts.factory.createIdentifier('map'),
            ),
            undefined,
            [
              ts.factory.createArrowFunction(
                undefined,
                undefined,
                [
                  ts.factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    undefined,
                    ts.factory.createIdentifier('_e'),
                    undefined,
                    undefined,
                    undefined,
                  ),
                ],
                undefined,
                ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                ts.factory.createElementAccessExpression(
                  ts.factory.createIdentifier(prop.items.type),
                  ts.factory.createAsExpression(
                    ts.factory.createIdentifier('_e'),
                    ts.factory.createKeywordTypeNode(actualEnumType),
                  ),
                ),
              ),
            ],
          ),
        );
        ctx.addImportsToTsFile(this.output, {
          from: this.config.tsTypeImport,
          items: [prop.items.type],
        });
      } else if (
        prop.type == 'array' &&
        ctx.isTypeHasEnumChild(prop.items.type)
      ) {
        // if array contains dto with enum child, call map and fromRaw/toRaw
        node = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(prop.name),
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createParenthesizedExpression(
                ts.factory.createBinaryExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(rawVarName),
                    ts.factory.createIdentifier(prop.name),
                  ),
                  ts.factory.createToken(ts.SyntaxKind.BarBarToken),
                  ts.factory.createArrayLiteralExpression([], false),
                ),
              ),
              ts.factory.createIdentifier('map'),
            ),
            undefined,
            [
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(
                  this.getGqlTypeNameFromName(prop.items.type),
                ),
                ts.factory.createIdentifier(methodForTypeWithChildEnum),
              ),
            ],
          ),
        );
        ctx.addImportsToTsFile(this.output, {
          from: this.config.tsTypeImport,
          items: [prop.items.type],
        });
      } else {
        // normal assign
        node = ts.factory.createPropertyAssignment(prop.name, propIdent);
      }
      literals.push(node);
    }
    return ts.factory.createBlock(
      [
        ts.factory.createIfStatement(
          ts.factory.createPrefixUnaryExpression(
            ts.SyntaxKind.ExclamationToken,
            ts.factory.createIdentifier(rawVarName),
          ),
          ts.factory.createBlock(
            [
              ts.factory.createReturnStatement(
                ts.factory.createAsExpression(
                  ts.factory.createIdentifier(rawVarName),
                  ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                ),
              ),
            ],
            true,
          ),
          undefined,
        ),
        ts.factory.createReturnStatement(
          ts.factory.createObjectLiteralExpression(literals, true),
        ),
      ],
      true,
    );
  }

  private genTscaUsecase(ctx: GContext, u: TscaUsecase): void {
    const importItems = [
      this.getUsecaseTypeName(u),
      this.getUsecaseTypeTokenName(u),
    ];

    // Import types and services
    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: importItems,
    });

    // Generate resolver methods
    // TODO: Add method that reads types.gen.gql.properties and generates @ResolveField() methods
    const methodNodes = u.methods
      .filter((m) => m.gen?.gql)
      .map((m) => this.genTscaMethod(ctx, u, m));

    // Create resolver class
    const node = ts.factory.createClassDeclaration(
      [
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('Resolver'),
            undefined,
            [],
          ),
        ),
      ],
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(_.upperFirst(u.name) + 'Resolver'),
      undefined,
      undefined,
      [
        ts.factory.createConstructorDeclaration(
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              [
                ts.factory.createDecorator(
                  ts.factory.createCallExpression(
                    ts.factory.createIdentifier('Inject'),
                    undefined,
                    [
                      ts.factory.createIdentifier(
                        this.getUsecaseTypeTokenName(u),
                      ),
                    ],
                  ),
                ),
              ],
              [
                ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword),
                ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword),
              ],
              undefined,
              ts.factory.createIdentifier(this.getUsecaseInstanceVarName(u)),
              undefined,
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier(this.getUsecaseTypeName(u)),
                undefined,
              ),
              undefined,
            ),
          ],
          ts.factory.createBlock([], false),
        ),
        ...methodNodes, // Add all the resolver methods
      ],
    );
    ctx.addNodesToTsFile(this.output, node);
  }

  private getGqlTypeNameFromName(name: string): string {
    return 'Gql' + name;
  }

  private genTscaMethodRequestObjectLiteralElementLikes(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
    reqVarName: string,
  ): ts.ObjectLiteralElementLike[] {
    const nodes: ts.ObjectLiteralElementLike[] = [];

    if (method.req && method.req.properties) {
      for (const prop of method.req.properties) {
        const propName = prop.name;
        const reqFieldIdent = ts.factory.createIdentifier(
          `${reqVarName}.${propName}`,
        );
        let assignNode: ts.ObjectLiteralElementLike = null;
        if (ctx.isTypeEnum(prop.type)) {
          assignNode = ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(propName),
            ts.factory.createElementAccessExpression(
              ts.factory.createIdentifier(prop.type),
              ts.factory.createAsExpression(
                reqFieldIdent,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              ),
            ),
          );
          ctx.addImportsToTsFile(this.output, {
            from: this.config.tsTypeImport,
            items: [prop.type],
          });
        } else if (prop.type && ctx.isTypeHasEnumChild(prop.type)) {
          // call this type's fromRaw
          assignNode = ts.factory.createPropertyAssignment(
            prop.name,
            ts.factory.createCallExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createIdentifier(
                  this.getGqlTypeNameFromName(prop.type),
                ),
                'toRaw',
              ),
              undefined,
              [reqFieldIdent],
            ),
          );
        } else {
          assignNode = ts.factory.createPropertyAssignment(
            propName,
            reqFieldIdent,
          );
        }
        nodes.push(assignNode);
      }
    }

    return nodes;
  }

  private genTscaMethodBlock(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.Block {
    const retVarName = '_res';
    const stmts: ts.Statement[] = [];

    const objLiterals: ts.ObjectLiteralElementLike[] = [
      ...this.genTscaMethodRequestObjectLiteralElementLikes(
        ctx,
        u,
        method,
        'request',
      ),
    ];

    if (u.gen.gql_resolver?.ctx2req) {
      const { ctx2req } = u.gen.gql_resolver;

      for (const ctxKey in ctx2req) {
        if (Object.prototype.hasOwnProperty.call(ctx2req, ctxKey)) {
          const reqKey = ctx2req[ctxKey];

          objLiterals.push(
            ts.factory.createShorthandPropertyAssignment(
              ts.factory.createIdentifier(reqKey),
              undefined,
            ),
          );
        }
      }
    }

    const rawReqVarStmt = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier('_req'),
            undefined,
            ts.factory.createTypeReferenceNode(
              ts.factory.createIdentifier(method.req.name),
              undefined,
            ),
            ts.factory.createObjectLiteralExpression(objLiterals, true),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [method.req.name],
    });

    const resStmt = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(retVarName),
            undefined,
            undefined,
            ts.factory.createAwaitExpression(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createThis(),
                    ts.factory.createIdentifier(
                      this.getUsecaseInstanceVarName(u),
                    ),
                  ),
                  ts.factory.createIdentifier(method.name),
                ),
                undefined,
                [ts.factory.createIdentifier('_req')],
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    let retStmt: ts.ReturnStatement = null;

    if (method.res && ctx.schemaContainsEnumChild(method.res)) {
      this.genTscaSchemaWithChildEnum(ctx, method.res);
      retStmt = ts.factory.createReturnStatement(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier(
              this.getGqlTypeNameFromName(method.res.name),
            ),
            ts.factory.createIdentifier('fromRaw'),
          ),
          undefined,
          [ts.factory.createIdentifier(retVarName)],
        ),
      );
    } else {
      retStmt = ts.factory.createReturnStatement(
        ts.factory.createIdentifier(retVarName),
      );
    }

    stmts.push(rawReqVarStmt);
    stmts.push(resStmt);
    stmts.push(retStmt);
    return ts.factory.createBlock(stmts, true);
  }
  private genTscaMethod(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.MethodDeclaration {
    const parameters: ts.ParameterDeclaration[] = [
      ts.factory.createParameterDeclaration(
        [
          ts.factory.createDecorator(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier('Args'),
              undefined,
              [ts.factory.createStringLiteral('request')],
            ),
          ),
        ],
        undefined,
        undefined,
        ts.factory.createIdentifier('request'),
        undefined,
        undefined,
        undefined,
      ),
    ];

    if (u.gen.gql_resolver?.ctx2req) {
      const { ctx2req } = u.gen.gql_resolver;

      for (const ctxKey in ctx2req) {
        if (Object.prototype.hasOwnProperty.call(ctx2req, ctxKey)) {
          const reqKey = ctx2req[ctxKey];

          parameters.push(
            ts.factory.createParameterDeclaration(
              [
                ts.factory.createDecorator(
                  ts.factory.createCallExpression(
                    ts.factory.createIdentifier('Context'),
                    undefined,
                    [ts.factory.createStringLiteral(ctxKey)],
                  ),
                ),
              ],
              undefined,
              undefined,
              ts.factory.createIdentifier(reqKey),
              undefined,
              undefined,
              // ts.factory.createTypeReferenceNode(
              //   ts.factory.createIdentifier(u.gen.gql_resolver.invokerType),
              //   undefined,
              // ),
              undefined,
            ),
          );
        }
      }
    }

    const node = ts.factory.createMethodDeclaration(
      [
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier(_.upperFirst(method.gen.gql.type)),
            undefined,
            [],
          ),
        ),
      ],
      [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      ts.factory.createIdentifier(method.name),
      undefined,
      undefined,
      parameters,
      undefined,
      this.genTscaMethodBlock(ctx, u, method),
    );
    return node;
  }
}
