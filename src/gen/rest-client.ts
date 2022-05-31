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
    def.types.forEach((i) => this.genTscaSchemaToDto(ctx, null, i, null));
    ctx.addNodesToTsFile(this.output, ...classes);
  }
  public before(ctx: GContext) {
    ctx.addImportsToTsFile(this.output, {
      from: 'axios',
      default: 'axios',
      items: ['AxiosInstance', 'AxiosRequestConfig'],
    },
      {
        from: '@nestjs/swagger',
        items: [
          'ApiPropertyOptional',
        ],
      });
    const baseClientNode = this.getBaseRestClient();

    ctx.addNodesToTsFile(this.output, baseClientNode);
  }
  public after(ctx: GContext) { }

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
  protected genTscaSchemaToDto(
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

  // Generate REST implementations of defined method interface
  private genTscaMethod(ctx: GContext, u: TscaUsecase, method: TscaMethod): ts.MethodDeclaration {
    const reqTypeName = this.getTscaMethodRequestTypeName(method);
    const resTypeName = this.getTscaMethodResponseTypeName(method);

    // Add imports of method request types
    ctx.addImportsToTsFile(this.output, {
      from: this.config.tsTypeImport,
      items: [reqTypeName, resTypeName],
    });

    const reqDtoTypeName = this.getDtoTypeNameFromName(reqTypeName);
    this.genTscaSchemaToDto(ctx, this.output, method.req, reqDtoTypeName);

    return ts.factory.createMethodDeclaration(
      undefined,
      undefined,
      undefined,
      ts.factory.createIdentifier(method.name),
      undefined,
      undefined,
      [ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        undefined,
        ts.factory.createIdentifier("request"),
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier(this.getTscaMethodRequestTypeName(method)),
          undefined
        ),
        undefined
      )],
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("Promise"),
        [ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier(this.getTscaMethodResponseTypeName(method)),
          undefined
        )]
      ),
      ts.factory.createBlock(
        [],
        true
      )
    );
  }

  private getRestClient(ctx: GContext, u: TscaUsecase): ts.ClassDeclaration {
    const interfaceName = this.getUsecaseTypeName(u);

    const methodNodes = u.methods
      .filter((m) => m.gen?.rest)
      .map((m) => this.genTscaMethod(ctx, u, m));

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
