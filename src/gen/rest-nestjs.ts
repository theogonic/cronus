import { Generator } from './base';
import * as ts from 'typescript';
import {
  RawTscaMethodRest,
  TscaDef,
  TscaMethod,
  TscaMethodRestParamDecoratorDecl,
  TscaSchema,
  TscaUsecase,
  TsDecoratorDecl,
  TsItem,
} from '../types';
import * as _ from 'lodash';
import { GContext } from '../context';
import { Register } from '../decorators';
import { BaseGeneratorConfig } from 'src/config';
import { isPrimitiveType } from './utils';

interface RestNestjsGeneratorConfig extends BaseGeneratorConfig {
  tsTypeImport: string;
}

@Register('rest-nestjs')
export class RestNestjsGenerator extends Generator<RestNestjsGeneratorConfig> {
  protected genTscaDef(ctx: GContext, def: TscaDef): void {
    ctx.addImportsToTsFile(
      this.output,
      {
        from: '@nestjs/swagger',
        items: [
          'ApiTags',
          'ApiPropertyOptional',
          'ApiProperty',
          'ApiOkResponse',
        ],
      },
      {
        from: '@nestjs/common',
        items: [
          'Inject',
          'Controller',
          'Get',
          'Post',
          'Delete',
          'Put',
          'Param',
          'Query',
          'Body',
          'ParseIntPipe',
        ],
      },
    );
    def.types.forEach((i) => this.genTscaSchemaToDto(ctx, null, i, null));

    def.usecases.forEach((u) => this.genTscaUsecase(ctx, u));
  }

  protected getDtoTypeNameFromName(type: string): string {
    return type + 'Dto';
  }

  protected getDtoTypeNameFromSchema(
    ctx: GContext,
    schema: TscaSchema,
  ): string {
    let typeName: string;

    if (schema.type === 'array') {
      typeName = schema.items.type;
    } else {
      typeName = schema.type;
    }

    let dtoTypeName: string;

    if (!isPrimitiveType(typeName)) {
      const refTySchema = ctx.getTypeSchemaByName(typeName);
      if (refTySchema.enum) {
        // is enum
        // 1. use original name instead of suffix 'Dto'
        // 2. import from tsType package
        dtoTypeName = this.getNamespaceAndTypeFromUserDefinedType(typeName)[1];
        ctx.addImportsToTsFile(this.output, {
          from: this.config.tsTypeImport,
          items: [dtoTypeName],
        });
      } else {
        dtoTypeName = this.getDtoTypeNameFromName(
          this.getNamespaceAndTypeFromUserDefinedType(typeName)[1],
        );
      }
    }
    return dtoTypeName;
  }
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
   * @param upt UsecaseParam 
   * @returns Typescript AST Node
   */
  private genTscaSchemaToDto(
    ctx: GContext,
    dstFile: string,
    schema: TscaSchema,
    overrideTypeName: string,
  ): ts.TypeNode {
    if (!schema) {
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
    }
    if (!dstFile) {
      dstFile = this.output;
    }

    if (schema.enum) {
      return ts.factory.createTypeReferenceNode(schema.name);
    }
    if (schema.type) {
      const dtoTypeName = this.getDtoTypeNameFromSchema(ctx, schema);

      return this.getTsTypeNodeFromSchemaWithType(
        ctx,
        dstFile,
        schema,
        dtoTypeName,
      );
    }
    let properties: ts.ClassElement[] = [];

    if (schema.properties) {
      properties = schema.properties.map((child) => {
        const decorator = this.getDtoDecoratorFromSchema(ctx, child);
        return ts.factory.createPropertyDeclaration(
          [decorator],
          undefined,
          ts.factory.createIdentifier(child.name),
          undefined,
          this.genTscaSchemaToDto(ctx, dstFile, child, null),
          undefined,
        );
      });
    }

    const dtoName =
      overrideTypeName || this.getDtoTypeNameFromName(schema.name);
    const node = ts.factory.createClassDeclaration(
      null,
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(dtoName),
      null,
      null,
      properties,
    );

    ctx.addNodesToTsFile(dstFile, node);

    return ts.factory.createTypeReferenceNode(dtoName);
  }

  getDtoDecoratorFromSchema(ctx: GContext, schema: TscaSchema): ts.Decorator {
    const args: ts.Expression[] = [];
    if (schema.type == 'array') {
      let objType: string;

      switch (schema.items.type) {
        case 'string': {
          objType = 'String';
          break;
        }
        case 'integer':
        case 'number': {
          objType = 'Number';
          break;
        }
        default:
          objType = this.getDtoTypeNameFromSchema(ctx, schema.items);
      }
      args.push(
        ts.factory.createObjectLiteralExpression(
          [
            ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier('type'),
              ts.factory.createArrayLiteralExpression(
                [ts.factory.createIdentifier(objType)],
                false,
              ),
            ),
          ],
          false,
        ),
      );
    } else if (!isPrimitiveType(schema.type)) {
      const refTySchema = ctx.getTypeSchemaByName(schema.type);
      if (refTySchema.enum) {
        args.push(
          ts.factory.createObjectLiteralExpression(
            [
              ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier('enum'),
                ts.factory.createIdentifier(schema.type),
              ),
            ],
            false,
          ),
        );
      }
    }
    return ts.factory.createDecorator(
      ts.factory.createCallExpression(
        schema.required
          ? ts.factory.createIdentifier('ApiProperty')
          : ts.factory.createIdentifier('ApiPropertyOptional'),
        undefined,
        args,
      ),
    );
  }

  private genCtrlClsDecorators(ctx: GContext, u: TscaUsecase): ts.Decorator[] {
    const decorators: ts.Decorator[] = [];

    decorators.push(
      ts.factory.createDecorator(
        ts.factory.createCallExpression(
          ts.factory.createIdentifier('Controller'),
          undefined,
          [ts.factory.createStringLiteral(u.gen?.rest?.apiPrefix || u.name)],
        ),
      ),
    );

    if (u.gen?.rest?.apiTags) {
      const apiTagArgs = u.gen?.rest?.apiTags.map((t) =>
        ts.factory.createStringLiteral(t),
      );
      decorators.push(
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('ApiTags'),
            undefined,
            apiTagArgs,
          ),
        ),
      );
    }

    return decorators;
  }
  /**
   * Generate a Nestjs REST controller for the given Usecase
   * Examples:
   * @ApiTags("<usecase>")
     @Controller('<usecase>')
     export class <usecase>Controller {
        constructor(@Inject(<usecase_service_token>) private readonly service: <usecase>){}

        @Post()
        @ApiOkResponse({ type: String })
        createAuth(@Body() body:CreateAuthRequestDto): Promise<string> {
            return this.service.createAuth(...);
        }
      }
    
   * @param upt UsecaseParam 
   * @returns Typescript AST Node
   */
  private genTscaUsecase(ctx: GContext, u: TscaUsecase): void {
    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [this.getUsecaseTypeName(u), this.getUsecaseTypeTokenName(u)],
    });

    const methodNodes = u.methods
      .filter((m) => m.gen?.rest)
      .map((m) => this.genTscaMethod(ctx, u, m));

    const decorators = this.genCtrlClsDecorators(ctx, u);
    const node = ts.factory.createClassDeclaration(
      decorators,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(_.upperFirst(u.name) + 'Controller'),
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
                this.getUsecaseTypeName(u),

                undefined,
              ),
              undefined,
            ),
          ],
          ts.factory.createBlock([], false),
        ),
        ...methodNodes,
      ],
    );

    ctx.addNodesToTsFile(this.output, node);
  }

  private genExtraImports(ctx: GContext, method: TscaMethod): void {
    if (method.gen.rest.extraImports) {
      method.gen.rest.extraImports.forEach((ei) => {
        ctx.addImportsToTsFile(this.output, {
          from: ei.from,
          items: ei.names,
        });
      });
    }
  }

  private getUsecaseInstanceVarName(u: TscaUsecase): string {
    return _.camelCase(this.getUsecaseTypeName(u));
  }

  private getNestjsHttpMethodDecoratorName(rest: RawTscaMethodRest): string {
    switch (rest.method) {
      case 'get':
        return 'Get'; // will be used like @Get(...)
      case 'post':
        return 'Post';
      case 'put':
        return 'Put';
      case 'delete':
        return 'Delete';
      default:
        throw new Error(`found unsupport http methold: ${rest.method}`);
    }
  }

  private getRestMethodDecorators(
    ctx: GContext,
    method: TscaMethod,
  ): ts.Decorator[] {
    const decorators: ts.Decorator[] = [];

    // nestjs http type decorator (get, post, etc..)
    decorators.push(
      ts.factory.createDecorator(
        ts.factory.createCallExpression(
          ts.factory.createIdentifier(
            this.getNestjsHttpMethodDecoratorName(method.gen?.rest),
          ),
          undefined,
          [ts.factory.createStringLiteral(method.gen?.rest.path)],
        ),
      ),
    );

    // nestjs return type decorator
    if (method.res && method.res.properties) {
      const resTypeName = this.getDtoTypeNameFromName(
        this.getTscaMethodResponseTypeName(method),
      );
      decorators.push(
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('ApiOkResponse'),
            undefined,
            [
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createPropertyAssignment(
                    ts.factory.createIdentifier('type'),
                    ts.factory.createIdentifier(resTypeName),
                  ),
                ],
                false,
              ),
            ],
          ),
        ),
      );
    }

    // user custom decorators
    const { methodDecorators } = method.gen.rest;
    if (methodDecorators) {
      const mds = methodDecorators.map((md) =>
        this.decoratorDeclToDecorator(ctx, md),
      );
      decorators.push(...mds);
    }

    return decorators;
  }

  private genExprsFromTsItems(items: TsItem[]): ts.Expression[] {
    return items.map((param) => {
      if (param.type == 'string') {
        if (typeof param.value !== 'string') {
          throw new Error('expect param is string');
        }
        return ts.factory.createStringLiteral(param.value);
      } else if (param.type == 'ident') {
        if (typeof param.value !== 'string') {
          throw new Error('expect param is string');
        }
        return ts.factory.createIdentifier(param.value);
      } else if (param.type == 'object') {
        const elmts: ts.ObjectLiteralElementLike[] = [];
        return ts.factory.createObjectLiteralExpression(
          [
            // TODO
            // ts.factory.createPropertyAssignment(
            //   ts.factory.createIdentifier('type'),
            //   ts.factory.createIdentifier(resTypeName),
            // ),
          ],
          false,
        );
      } else {
        throw new Error(`found unsupported param type ${param.type}`);
      }
    });
  }
  private decoratorDeclToDecorator(
    ctx: GContext,
    decl: TsDecoratorDecl,
  ): ts.Decorator {
    ctx.addImportsToTsFile(this.output, {
      from: decl.from,
      items: [decl.name],
    });

    let args: ts.Expression[];
    if (decl.params) {
      args = this.genExprsFromTsItems(decl.params);
    }

    return ts.factory.createDecorator(
      ts.factory.createCallExpression(
        ts.factory.createIdentifier(decl.name),
        undefined,
        args,
      ),
    );
  }
  private genTscaMethod(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.MethodDeclaration {
    this.genExtraImports(ctx, method);
    const reqTypeName = this.getDtoTypeNameFromName(
      this.getTscaMethodRequestTypeName(method),
    );
    const resTypeName = this.getDtoTypeNameFromName(
      this.getTscaMethodResponseTypeName(method),
    );
    this.genTscaSchemaToDto(ctx, this.output, method.req, reqTypeName);
    this.genTscaSchemaToDto(ctx, this.output, method.res, resTypeName);

    const paramNodes = this.genTscaMethodParameters(ctx, u, method);
    const methodDecorators = this.getRestMethodDecorators(ctx, method);
    return ts.factory.createMethodDeclaration(
      methodDecorators,
      undefined,
      undefined,
      ts.factory.createIdentifier(method.name),
      undefined,
      undefined,
      paramNodes,
      undefined,
      this.genTscaMethodBlock(ctx, u, method),
    );
  }

  /**
   * parseRestPathVars find all variables in the given URL path
   * @param restPath Restful URL path template
   * Ex. user/:id/profile/:prop => [id, prop]
   */
  private parseRestPathVars(restPath: string): string[] {
    return restPath
      .split('/')
      .filter((s) => s.startsWith(':'))
      .map((s) => s.substr(1));
  }

  private getTscaMetholdRestBodyDtoTypeName(method: TscaMethod): string {
    return this.getTscaMethodRequestTypeName(method) + 'BodyDto';
  }

  private genTscaMethodRestQueryParam(
    ctx: GContext,
    method: TscaMethod,
  ): ts.ParameterDeclaration[] | null {
    const queryVars = method.gen?.rest.query;
    if (!queryVars) {
      return null;
    }

    // @Query('id') id: string
    return queryVars.map((v) => {
      const args: ts.Expression[] = [ts.factory.createStringLiteral(v)];
      const vProp = method.req.getPropByName(v);
      let vPropKind: ts.SyntaxKind;

      if (vProp.type == 'number' || vProp.type == 'integer') {
        args.push(ts.factory.createIdentifier('ParseIntPipe'));
        vPropKind = ts.SyntaxKind.NumberKeyword;
      } else {
        vPropKind = ts.SyntaxKind.StringKeyword;
      }

      return ts.factory.createParameterDeclaration(
        [
          ts.factory.createDecorator(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier('Query'),
              undefined,
              args,
            ),
          ),
        ],
        undefined,
        undefined,
        ts.factory.createIdentifier(v),
        undefined,
        ts.factory.createKeywordTypeNode(vPropKind),
        undefined,
      );
    });
  }

  private getTscaMethodRestBodyPropNames(method: TscaMethod): string[] {
    const pathVars = this.parseRestPathVars(method.gen?.rest.path);
    const queryVars = method.gen?.rest.query || [];
    const req = method.req.properties;
    return req
      .filter((r) => !queryVars.includes(r.name) && !pathVars.includes(r.name))
      .map((schema) => schema.name);
  }

  private genTscaMethodRestBodyParam(
    ctx: GContext,
    method: TscaMethod,
    dstFile: string,
  ): ts.ParameterDeclaration | null {
    const bodyPropNames = this.getTscaMethodRestBodyPropNames(method);
    const bodyVars = method.req.properties.filter((r) =>
      bodyPropNames.includes(r.name),
    );
    if (!bodyVars) {
      return null;
    }
    const bodySchema = { ...method.req };
    bodySchema.properties = bodyVars;

    const bodyDtoType = this.getTscaMetholdRestBodyDtoTypeName(method);
    this.genTscaSchemaToDto(
      ctx,
      dstFile,
      bodySchema as TscaSchema,
      bodyDtoType,
    );
    return ts.factory.createParameterDeclaration(
      [
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('Body'),
            undefined,
            [],
          ),
        ),
      ],
      undefined,
      undefined,
      ts.factory.createIdentifier('body'),
      undefined,
      ts.factory.createTypeReferenceNode(bodyDtoType),
      undefined,
    );
  }

  private genTscaMethodParameters(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.ParameterDeclaration[] {
    const nodes: ts.ParameterDeclaration[] = [];

    // path variables
    const pathVars = this.parseRestPathVars(method.gen?.rest.path);

    if (pathVars) {
      // @Param('id') id: string
      const pathVarNodes = pathVars.map((v) => {
        const args: ts.Expression[] = [ts.factory.createStringLiteral(v)];
        const vProp = method.req.getPropByName(v);
        let vPropKind: ts.SyntaxKind;

        if (vProp.type == 'number' || vProp.type == 'integer') {
          args.push(ts.factory.createIdentifier('ParseIntPipe'));
          vPropKind = ts.SyntaxKind.NumberKeyword;
        } else {
          vPropKind = ts.SyntaxKind.StringKeyword;
        }
        return ts.factory.createParameterDeclaration(
          [
            ts.factory.createDecorator(
              ts.factory.createCallExpression(
                ts.factory.createIdentifier('Param'),
                undefined,
                args,
              ),
            ),
          ],
          undefined,
          undefined,
          ts.factory.createIdentifier(v),
          undefined,
          ts.factory.createKeywordTypeNode(vPropKind),
          undefined,
        );
      });

      nodes.push(...pathVarNodes);
    }

    // query variables
    const queryVarNodes = this.genTscaMethodRestQueryParam(ctx, method);
    if (queryVarNodes) {
      nodes.push(...queryVarNodes);
    }

    // body variables
    if (method.gen?.rest.method != 'get') {
      const bodyNode = this.genTscaMethodRestBodyParam(
        ctx,
        method,
        this.output,
      );

      if (bodyNode) {
        nodes.push(bodyNode);
      }
    }

    // user custom param with decorator
    if (method.gen.rest?.paramDecorators) {
      const paramNodes = method.gen.rest.paramDecorators.map((d) =>
        this.genCustomParams(ctx, d),
      );
      nodes.push(...paramNodes);
    }
    return nodes;
  }

  private genCustomParams(
    ctx: GContext,
    decl: TscaMethodRestParamDecoratorDecl,
  ): ts.ParameterDeclaration {
    const decorator = this.decoratorDeclToDecorator(ctx, decl);
    return ts.factory.createParameterDeclaration(
      [decorator],
      undefined,
      undefined,
      ts.factory.createIdentifier(decl.reqProp),
      undefined,
      undefined,
      undefined,
    );
  }

  private genTscaMethodRequestObjectLiteralElementLikes(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.ObjectLiteralElementLike[] {
    const nodes: ts.ObjectLiteralElementLike[] = [];
    const queryVars = method.gen?.rest.query;
    if (queryVars) {
      // query variables
      queryVars.forEach((propName) => {
        nodes.push(
          ts.factory.createShorthandPropertyAssignment(propName, undefined),
        );
      });
    }

    const pathVars = this.parseRestPathVars(method.gen?.rest.path);
    if (pathVars) {
      // path variables
      pathVars.forEach((propName) => {
        nodes.push(
          ts.factory.createShorthandPropertyAssignment(propName, undefined),
        );
      });
    }

    const bodyVars = this.getTscaMethodRestBodyPropNames(method);
    if (bodyVars) {
      bodyVars.forEach((propName) =>
        nodes.push(
          ts.factory.createPropertyAssignment(
            propName,
            ts.factory.createIdentifier(`body.${propName}`),
          ),
        ),
      );
    }

    if (method.gen.rest.paramDecorators) {
      const customParams = method.gen.rest.paramDecorators.map((decl) =>
        ts.factory.createShorthandPropertyAssignment(decl.reqProp, undefined),
      );
      nodes.push(...customParams);
    }

    return nodes;
  }

  private genTscaMethodBlock(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.Block {
    const reqVarName = 'ucReq';
    const reqVarType = this.getTscaMethodRequestTypeName(method);

    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [reqVarType],
    });

    const requestAssignmentNodes =
      this.genTscaMethodRequestObjectLiteralElementLikes(ctx, u, method);
    const blockNode = ts.factory.createBlock(
      [
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                ts.factory.createIdentifier(reqVarName),
                undefined,
                undefined,
                ts.factory.createAsExpression(
                  ts.factory.createObjectLiteralExpression(
                    requestAssignmentNodes,
                    true,
                  ),
                  ts.factory.createTypeReferenceNode(reqVarType, undefined),
                ),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        ts.factory.createReturnStatement(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createPropertyAccessExpression(
                ts.factory.createThis(),
                ts.factory.createIdentifier(this.getUsecaseInstanceVarName(u)),
              ),
              ts.factory.createIdentifier(method.name),
            ),
            undefined,
            [ts.factory.createIdentifier(reqVarName)],
          ),
        ),
      ],
      true,
    );

    return blockNode;
  }
}
