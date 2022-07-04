import * as _ from 'lodash';
import { BaseGeneratorConfig } from 'src/config';
import * as ts from 'typescript';
import { GContext } from '../context';
import { Register } from '../decorators';
import {
  RawTscaCustomAssignment,
  RawTscaMethodRest,
  TscaDef,
  TscaMethod,
  TscaSchema,
  TscaUsecase,
  TsDecoratorDecl,
  TsItem,
} from '../types';
import { Generator } from './base';
import {
  getKeywordType,
  getNameOfFlatternProp,
  getPropByFlatternProp,
  getTscaMethodQueryVars,
  getTscaMethodRestBodyPropNames,
  getTsTypeConstructor,
  isPrimitiveType,
  isTypeBoolean,
  isTypeNumber,
  parseRestPathVars,
} from './utils';

interface RestNestjsGeneratorConfig extends BaseGeneratorConfig {
  tsTypeImport: string;
}

@Register('rest_nestjs')
export class RestNestJsGenerator extends Generator<RestNestjsGeneratorConfig> {
  private readonly helperFile = 'zeusHelpers.ts';

  public before(ctx: GContext) {
    const zeusRestNestjsHelperFile = path.join(
      path.dirname(this.output),
      this.helperFile,
    );

    ctx.addStrToTextFile(zeusRestNestjsHelperFile, ``);
  }
  public after(ctx: GContext) {
    ctx;
  }
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
          'ApiBearerAuth',
          'ApiQuery',
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
          'ParseBoolPipe',
          'ParseArrayPipe',
        ],
      },
      {
        from: this.helperFile,
        items: ['ZeusParseIntPipe', 'ZeusParseBoolPipe'],
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
      // no need to generate dto wrapper with enum since it simply a string or number
      return ts.factory.createTypeReferenceNode(schema.name);
    }
    if (schema.type) {
      // make sure type is import properly
      const dtoTypeName = this.getDtoTypeNameFromSchema(ctx, schema);

      // if type is enum, in dto it should be treated as string for readibility and common framework settings(nestjs)
      if (ctx.isTypeEnum(schema.type)) {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      }

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
          child.required
            ? undefined
            : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          this.genTscaSchemaToDto(ctx, dstFile, child, null),
          undefined,
        );
      });
    }

    const dtoName =
      overrideTypeName || this.getDtoTypeNameFromName(schema.name);

    // check if need to generate fromRaw for serial/deserial enum
    if (ctx.schemaContainsEnumChild(schema)) {
      ctx.addImportsToTsFile(this.output, {
        from: this.config.tsTypeImport,
        items: [schema.name],
      });
      properties.push(this.genFromRawMethodForDto(ctx, dtoName, schema));
    }
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

  genFromRawMethodBodyForDto(
    ctx: GContext,
    schema: TscaSchema,
    rawVarName = 'raw',
  ): ts.Block {
    const literals: ts.ObjectLiteralElementLike[] = [];

    for (const prop of schema.properties) {
      let node: ts.ObjectLiteralElementLike = null;
      const propIdent = ts.factory.createIdentifier(
        `${rawVarName}.${prop.name}`,
      );
      if (prop.type && ctx.isTypeEnum(prop.type)) {
        // do deserilization
        node = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(prop.name),
          ts.factory.createElementAccessExpression(
            ts.factory.createIdentifier(prop.type),
            propIdent,
          ),
        );
      } else if (prop.type && ctx.isTypeHasEnumChild(prop.type)) {
        // call this type's fromRaw
        node = ts.factory.createPropertyAssignment(
          prop.name,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(
                this.getDtoTypeNameFromName(prop.type),
              ),
              'fromRaw',
            ),
            undefined,
            [propIdent],
          ),
        );
      } else if (
        prop.type == 'array' &&
        ctx.isTypeHasEnumChild(prop.items.type)
      ) {
        // if array contains dto with enum, call map and fromRaw
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
                  this.getDtoTypeNameFromName(prop.items.type),
                ),
                ts.factory.createIdentifier('fromRaw'),
              ),
            ],
          ),
        );
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
  genFromRawMethodForDto(
    ctx: GContext,
    dtoType: string,
    schema: TscaSchema,
  ): ts.MethodDeclaration {
    return ts.factory.createMethodDeclaration(
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
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(schema.name),
            undefined,
          ),
          undefined,
        ),
      ],
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier(dtoType),
        undefined,
      ),
      this.genFromRawMethodBodyForDto(ctx, schema, 'raw'),
    );
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
        case 'int32':
        case 'i32':
        case 'float':
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

    if (u.gen?.rest?.apiTags || u.gen?.rest?.apiTag) {
      let apiTagArgs: ts.StringLiteral[] = [];
      apiTagArgs = apiTagArgs.concat(
        ...u.gen?.rest?.apiTags?.map((t) => ts.factory.createStringLiteral(t)),
      );

      if (u.gen.rest.apiTag) {
        apiTagArgs.push(ts.factory.createStringLiteral(u.gen.rest.apiTag));
      }

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

    if (u.gen?.rest?.apiBearerAuth) {
      decorators.push(
        ts.factory.createDecorator(
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('ApiBearerAuth'),
            undefined,
            [],
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
      const { extraImports } = method.gen.rest;
      for (const key in extraImports) {
        if (Object.prototype.hasOwnProperty.call(extraImports, key)) {
          const from = extraImports[key];
          ctx.addImportsToTsFile(this.output, {
            from,
            items: [key],
          });
        }
      }
    }
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
        throw new Error(`found unsupport http method: ${rest.method}`);
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
      for (const key in methodDecorators) {
        if (Object.prototype.hasOwnProperty.call(methodDecorators, key)) {
          const decl = methodDecorators[key];
          decorators.push(this.decoratorDeclToDecorator(ctx, decl));
        }
      }
    }

    // optional query if any
    const flatternQueryVars = getTscaMethodQueryVars(ctx, method, true);
    if (flatternQueryVars) {
      flatternQueryVars.forEach((flatternQueryVar) => {
        // @ApiQuery({ name: 'role', enum: UserRole })

        // optional
        // enum
        const queryVarProp = getPropByFlatternProp(
          ctx,
          method.req,
          flatternQueryVar,
        );
        const queryVarType = queryVarProp.type;
        const queryVarName = getNameOfFlatternProp(flatternQueryVar);
        const literalProps = [
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier('name'),
            ts.factory.createStringLiteral(queryVarName),
          ),
          ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier('required'),
            queryVarProp.required
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ),
        ];

        if (ctx.isTypeEnum(queryVarType)) {
          ctx.addImportsToTsFile(this.output, {
            items: [queryVarType],
            from: this.config.tsTypeImport,
          });

          literalProps.push(
            ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier('enum'),
              ts.factory.createIdentifier(queryVarType),
            ),
          );
        }

        decorators.push(
          ts.factory.createDecorator(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier('ApiQuery'),
              undefined,
              [ts.factory.createObjectLiteralExpression(literalProps, false)],
            ),
          ),
        );
      });
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
    // const reqTypeName = this.getDtoTypeNameFromName(
    //   this.getTscaMethodRequestTypeName(method),
    // );
    const resTypeName = this.getDtoTypeNameFromName(
      this.getTscaMethodResponseTypeName(method),
    );
    // this.genTscaSchemaToDto(ctx, this.output, method.req, reqTypeName);
    this.genTscaSchemaToDto(ctx, this.output, method.res, resTypeName);

    const paramNodes = this.genTscaMethodParameters(ctx, u, method);
    const methodDecorators = this.getRestMethodDecorators(ctx, method);

    return ts.factory.createMethodDeclaration(
      methodDecorators,
      [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      ts.factory.createIdentifier(method.name),
      undefined,
      undefined,
      paramNodes,
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('Promise'),
        [
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(resTypeName),
            undefined,
          ),
        ],
      ),
      this.genTscaMethodBlock(ctx, u, method),
    );
  }

  private getTscaMetholdRestBodyDtoTypeName(method: TscaMethod): string {
    return this.getTscaMethodRequestTypeName(method) + 'BodyDto';
  }

  private genTscaMethodRestQueryParam(
    ctx: GContext,
    method: TscaMethod,
  ): ts.ParameterDeclaration[] | null {
    const flatternQueryVars = getTscaMethodQueryVars(ctx, method, true);
    if (!flatternQueryVars) {
      return null;
    }

    // @Query('id') id: string
    return flatternQueryVars.map((flatternQueryVar) => {
      const queryVarName = getNameOfFlatternProp(flatternQueryVar);
      const args: ts.Expression[] = [
        ts.factory.createStringLiteral(queryVarName),
      ];
      const vProp = getPropByFlatternProp(ctx, method.req, flatternQueryVar);
      let vPropTy: ts.TypeNode;

      if (
        vProp.type == 'number' ||
        vProp.type == 'integer' ||
        vProp.type == 'i32' ||
        vProp.type == 'int32' ||
        vProp.type == 'float'
      ) {
        args.push(ts.factory.createIdentifier('ParseIntPipe'));
        vPropTy = ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      } else if (vProp.type == 'boolean' || vProp.type == 'bool') {
        args.push(ts.factory.createIdentifier('ParseBoolPipe'));
        vPropTy = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.BooleanKeyword,
        );
      } else if (vProp.type == 'array') {
        // TODO: complete conditions here
        if (
          !vProp.items ||
          (!isTypeBoolean(vProp.items.type) &&
            !isTypeNumber(vProp.items.type) &&
            !(vProp.items.type == 'string'))
        ) {
          throw new Error(
            `query param array does not support items type ${vProp.items.type}`,
          );
        }
        args.push(
          ts.factory.createNewExpression(
            ts.factory.createIdentifier('ParseArrayPipe'),
            undefined,
            [
              ts.factory.createObjectLiteralExpression(
                [
                  ts.factory.createPropertyAssignment(
                    ts.factory.createIdentifier('items'),
                    ts.factory.createIdentifier(
                      getTsTypeConstructor(vProp.items.type),
                    ),
                  ),
                  ts.factory.createPropertyAssignment(
                    ts.factory.createIdentifier('optional'),
                    ts.factory.createIdentifier('true'),
                  ),
                ],
                true,
              ),
            ],
          ),
        );
        vPropTy = ts.factory.createArrayTypeNode(
          ts.factory.createKeywordTypeNode(getKeywordType(vProp.items.type)),
        );
      } else {
        vPropTy = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
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
        ts.factory.createIdentifier(queryVarName),
        undefined,
        vPropTy,
        undefined,
      );
    });
  }

  private genTscaMethodRestBodyParam(
    ctx: GContext,
    method: TscaMethod,
    dstFile: string,
  ): ts.ParameterDeclaration | null {
    const bodyPropNames = getTscaMethodRestBodyPropNames(ctx, method);
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
    const pathVars = parseRestPathVars(method.gen?.rest.path);

    if (pathVars) {
      // @Param('id') id: string
      const pathVarNodes = pathVars.map((v) => {
        const args: ts.Expression[] = [ts.factory.createStringLiteral(v)];
        const vProp = method.req.getPropByName(v);
        let vPropKind: ts.SyntaxKind;

        if (vProp.type == 'number' || vProp.type == 'integer') {
          args.push(ts.factory.createIdentifier('ParseIntPipe'));
          vPropKind = ts.SyntaxKind.NumberKeyword;
        } else if (vProp.type == 'boolean') {
          args.push(ts.factory.createIdentifier('ParseBoolPipe'));
          vPropKind = ts.SyntaxKind.BooleanKeyword;
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

    const customReqParams = {
      ...(u.gen?.rest?.reqParams || {}),
      ...(method.gen?.rest?.reqParams || {}),
    };

    // user custom param with decorator

    for (const key in customReqParams) {
      if (Object.prototype.hasOwnProperty.call(customReqParams, key)) {
        const element = customReqParams[key];
        if (element.decorator) {
          nodes.push(this.genCustomParamByDecoratorAssign(ctx, key, element));
        }
      }
    }

    return nodes;
  }

  private genCustomParamByDecoratorAssign(
    ctx: GContext,
    reqParam: string,
    customAssign: RawTscaCustomAssignment,
  ): ts.ParameterDeclaration {
    if (customAssign.decorator) {
      const decorator = this.decoratorDeclToDecorator(
        ctx,
        customAssign.decorator,
      );
      return ts.factory.createParameterDeclaration(
        [decorator],
        undefined,
        undefined,
        ts.factory.createIdentifier(reqParam),
        undefined,
        undefined,
        undefined,
      );
    } else {
      throw new Error(
        '[internal error] incorrect assignment type, expect decorator',
      );
    }
  }

  private genObjectLiteralForFlatternProp(
    ctx: GContext,
    schema: TscaSchema,
    parentFlatterns: string[],
    flatternQueryProps: string[][],
  ): ts.ObjectLiteralExpression {
    // cluster flattern query props by first prop
    const clusteredFlatterns = {};
    flatternQueryProps.forEach((q) => {
      if (q.length == 1) {
        clusteredFlatterns[q[0]] = [];
      } else {
        if (!(q[0] in clusteredFlatterns)) {
          clusteredFlatterns[q[0]] = [];
        }
        clusteredFlatterns[q[0]].push(q.slice(1));
      }
    });
    const nodes: ts.ObjectLiteralElementLike[] = [];
    Object.keys(clusteredFlatterns).forEach((propName) => {
      const propSchema = schema.getPropByName(propName);

      let assignNode: ts.ObjectLiteralElementLike = null;
      if (ctx.isTypeEnum(propSchema.type)) {
        const propActualName = getNameOfFlatternProp([
          ...parentFlatterns,
          propName,
        ]);
        assignNode = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(propName),
          ts.factory.createElementAccessExpression(
            ts.factory.createIdentifier(propSchema.type),
            ts.factory.createIdentifier(propActualName),
          ),
        );
      } else if (
        !isPrimitiveType(propSchema.type) &&
        propSchema.type != 'array'
      ) {
        // this prop is not primitive type
        // filter all flattern query props under this type
        const childActualSchema = ctx.getTypeSchemaByName(propSchema.type);
        assignNode = ts.factory.createPropertyAssignment(
          ts.factory.createIdentifier(propName),
          this.genObjectLiteralForFlatternProp(
            ctx,
            childActualSchema,
            [...parentFlatterns, propName],
            clusteredFlatterns[propName],
          ),
        );
      } else {
        const propActualName = getNameOfFlatternProp([
          ...parentFlatterns,
          propName,
        ]);
        assignNode = ts.factory.createPropertyAssignment(
          propName,
          ts.factory.createIdentifier(propActualName),
        );
      }
      nodes.push(assignNode);
    });

    return ts.factory.createObjectLiteralExpression(nodes, true);
  }

  // generate req object construction from method parameters
  private genTscaMethodRequestObjectLiteralElementLikes(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.ObjectLiteralElementLike[] {
    const nodes: ts.ObjectLiteralElementLike[] = [];
    const queryVars = getTscaMethodQueryVars(ctx, method, true);
    if (queryVars) {
      const obj = this.genObjectLiteralForFlatternProp(
        ctx,
        method.req,
        [],
        queryVars,
      );
      nodes.push(...obj.properties);
    }

    const pathVars = parseRestPathVars(method.gen?.rest.path);
    if (pathVars) {
      // path variables
      pathVars.forEach((propName) => {
        nodes.push(
          ts.factory.createShorthandPropertyAssignment(propName, undefined),
        );
      });
    }

    const bodyVars = getTscaMethodRestBodyPropNames(ctx, method);
    if (bodyVars) {
      bodyVars.forEach((propName) => {
        const propSchema = method.req.getPropByName(propName);
        let assignNode: ts.ObjectLiteralElementLike = null;
        if (ctx.isTypeEnum(propSchema.type)) {
          assignNode = ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(propName),
            ts.factory.createElementAccessExpression(
              ts.factory.createIdentifier(propSchema.type),
              ts.factory.createIdentifier(`body.${propName}`),
            ),
          );
        } else {
          assignNode = ts.factory.createPropertyAssignment(
            propName,
            ts.factory.createIdentifier(`body.${propName}`),
          );
        }

        nodes.push(assignNode);
      });
    }

    const allReqParams = {
      ...(u.gen?.rest?.reqParams || {}),
      ...(method.gen?.rest?.reqParams || {}),
    };

    for (const key in allReqParams) {
      if (Object.prototype.hasOwnProperty.call(allReqParams, key)) {
        const element = allReqParams[key];
        if (element.decorator) {
          nodes.push(
            ts.factory.createShorthandPropertyAssignment(key, undefined),
          );
        }
      }
    }

    return nodes;
  }

  private genTscaMethodBlock(
    ctx: GContext,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.Block {
    const reqVarName = '_req';
    const retVarName = '_res';
    const reqVarType = this.getTscaMethodRequestTypeName(method);

    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [reqVarType],
    });

    const requestAssignmentNodes =
      this.genTscaMethodRequestObjectLiteralElementLikes(ctx, u, method);

    let retStmt: ts.ReturnStatement = null;

    if (method.res && ctx.schemaContainsEnumChild(method.res)) {
      retStmt = ts.factory.createReturnStatement(
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier(
              this.getDtoTypeNameFromName(method.res.name),
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

    const queryVars = getTscaMethodQueryVars(ctx, method, true);

    const blockNode = ts.factory.createBlock(
      [
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                ts.factory.createIdentifier(reqVarName),
                undefined,
                ts.factory.createTypeReferenceNode(reqVarType, undefined),
                ts.factory.createObjectLiteralExpression(
                  requestAssignmentNodes,
                  true,
                ),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        ts.factory.createVariableStatement(
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
                    [ts.factory.createIdentifier(reqVarName)],
                  ),
                ),
              ),
            ],
            ts.NodeFlags.Const,
          ),
        ),
        retStmt,
      ],
      true,
    );

    return blockNode;
  }
}
