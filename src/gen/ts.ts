import { Generator } from './base';
import * as ts from 'typescript';
import { TscaDef, TscaMethod, TscaSchema, TscaUsecase } from '../types';
import * as _ from 'lodash';
import { GContext } from '../context';
import { Register } from '../decorators';

@Register('ts')
export class TypescriptGenerator extends Generator {
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    def.usecases.forEach((u) => this.genTscaUsecase(ctx, def, u));
    def.types.forEach((e) => this.genTscaSchema(ctx, def, null, e, null));
  }

  private genTscaUsecase(ctx: GContext, def: TscaDef, usecase: TscaUsecase) {
    const methodNodes: ts.TypeElement[] = [];

    usecase.methods.forEach((m) =>
      methodNodes.push(this.genTscaMethod(ctx, def, usecase, m)),
    );

    const node = ts.factory.createInterfaceDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(this.getUsecaseTypeName(usecase)),
      undefined,
      undefined,
      methodNodes,
    );

    const exportTokenNode = this.getExportUsecaseTokenNode(usecase);
    ctx.addNodesToTsFile(this.output, node, exportTokenNode);
  }

  genEnumTscaSchema(ctx: GContext, schema: TscaSchema): ts.TypeNode {
    const decl = this.genEnumFromSchema(schema);
    ctx.addNodesToTsFile(this.output, decl);
    return ts.factory.createTypeReferenceNode(schema.name);
  }

  genTscaSchema(
    ctx: GContext,
    def: TscaDef,
    dstFile: string,
    schema: TscaSchema,
    overrideName: string,
  ): ts.TypeNode {
    if (!dstFile) {
      dstFile = this.output;
    }
    if (schema.enum) {
      return this.genEnumTscaSchema(ctx, schema);
    }
    if (schema.type) {
      return this.getTsTypeNodeFromSchemaWithType(
        ctx,
        dstFile,
        schema,
        overrideName,
      );
    }

    let propSigs: ts.PropertySignature[] = [];

    if (schema.properties) {
      propSigs = schema.properties.map((propSchema) =>
        ts.factory.createPropertySignature(
          undefined,
          ts.factory.createIdentifier(propSchema.name),
          propSchema.required
            ? undefined
            : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
          this.genTscaSchema(ctx, def, dstFile, propSchema, null),
        ),
      );
    }
    const heritages: ts.HeritageClause[] = [];
    if (schema.extends) {
      schema.extends.forEach((ext) => {
        heritages.push(
          ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
              ts.factory.createIdentifier(ext),
              undefined,
            ),
          ]),
        );
      });
    }

    const node = ts.factory.createInterfaceDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(overrideName || schema.name),
      undefined,
      heritages,
      propSigs,
    );

    ctx.addNodesToTsFile(dstFile, node);

    return ts.factory.createTypeReferenceNode(overrideName || schema.name);
  }

  private getExportUsecaseTokenNode(
    usecase: TscaUsecase,
  ): ts.VariableStatement {
    const node = ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createIdentifier(this.getUsecaseTypeTokenName(usecase)),
            undefined,
            undefined,
            ts.factory.createCallExpression(
              ts.factory.createIdentifier('Symbol'),
              undefined,
              [
                ts.factory.createStringLiteral(
                  this.getUsecaseTypeTokenName(usecase),
                ),
              ],
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    );

    return node;
  }
  private genTscaMethod(
    ctx: GContext,
    def: TscaDef,
    u: TscaUsecase,
    method: TscaMethod,
  ): ts.TypeElement {
    const reqTypeName = this.getTscaMethodRequestTypeName(method);
    const resTypeName = this.getTscaMethodResponseTypeName(method);
    this.genTscaSchema(ctx, def, this.output, method.req, reqTypeName);
    this.genTscaSchema(ctx, def, this.output, method.res, resTypeName);
    return ts.factory.createMethodSignature(
      undefined,
      ts.factory.createIdentifier(method.name),
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
            ts.factory.createIdentifier(reqTypeName),
            undefined,
          ),
          undefined,
        ),
      ],
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier('Promise'),
        [
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier(resTypeName),
            undefined,
          ),
        ],
      ),
    );
  }
}
