import { GContext } from 'src/context';
import { TscaDef, TscaSchema } from 'src/types';
import { Generator } from './base';
import { Register } from '../decorators';
import { BaseGeneratorConfig } from 'src/config';
import * as ts from 'typescript';

interface GeneralEntityGeneratorConfig extends BaseGeneratorConfig {
  generalEntityImport: string;
  tsTypeImport: string;
}

const EntityToExtendTy = 'BaseGeneralEntity';
const EntityMetadataTy = 'GeneralEntityMetadata';
const EntityMetaVar = 'meta';
const EntityObjVar = 'obj';

@Register('general-entity')
export class GeneralEntityGenerator extends Generator<GeneralEntityGeneratorConfig> {
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    this.initImport(ctx);
    def.types
      .filter((ty) => ty.gen?.['general-entity'] !== undefined)
      .forEach((ty) => this.genTscaSchemaToGeneralEntity(ctx, ty));
  }

  initImport(ctx: GContext) {
    ctx.addImportsToTsFile(this.output, {
      items: [EntityToExtendTy, EntityMetadataTy],
      from: this.config.generalEntityImport,
    });
  }

  checkTscaSchemaIsGeneralEntity(schema: TscaSchema): void {
    if (!schema.getPropByName(EntityMetaVar)) {
      throw new Error(
        `missing '${EntityMetaVar}' property in type '${schema.name}'`,
      );
    }
  }

  private getGeneralEntityTy(schema: TscaSchema): string {
    return schema.name + 'Entity';
  }

  genObjAssignments(schema: TscaSchema): ts.ExpressionStatement[] {
    const stmts = schema.properties
      .filter((prop) => prop.name != EntityMetaVar)
      .map((propSchema) => {
        const { name } = propSchema;

        return ts.factory.createExpressionStatement(
          ts.factory.createBinaryExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createThis(),
              ts.factory.createIdentifier(name),
            ),
            ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier(EntityObjVar),
              ts.factory.createIdentifier(name),
            ),
          ),
        );
      });

    return stmts;
  }

  genPropDeclarations(schema: TscaSchema): ts.PropertyDeclaration[] {
    const propDecls = schema.properties
      .filter((prop) => prop.name != EntityMetaVar)
      .map((propSchema) => {
        const { name } = propSchema;
        return ts.factory.createPropertyDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createIndexedAccessTypeNode(
            ts.factory.createTypeReferenceNode(
              ts.factory.createIdentifier(schema.name),
              undefined,
            ),
            ts.factory.createLiteralTypeNode(
              ts.factory.createStringLiteral(name),
            ),
          ),
          undefined,
        );
      });

    return propDecls;
  }

  genTscaSchemaToGeneralEntity(ctx: GContext, schema: TscaSchema): void {
    this.checkTscaSchemaIsGeneralEntity(schema);
    ctx.addImportsToTsFile(this.output, {
      items: [schema.name],
      from: this.config.tsTypeImport,
    });

    const geTy = this.getGeneralEntityTy(schema);
    const propDecls = this.genPropDeclarations(schema);
    const assignments = this.genObjAssignments(schema);
    const entityClass = ts.factory.createClassDeclaration(
      undefined,
      undefined,
      geTy,
      undefined,
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createIdentifier(EntityToExtendTy),
            undefined,
          ),
        ]),
        ts.factory.createHeritageClause(ts.SyntaxKind.ImplementsKeyword, [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createIdentifier(schema.name),
            undefined,
          ),
        ]),
      ],
      [
        ts.factory.createConstructorDeclaration(
          undefined,
          undefined,
          [
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              ts.factory.createIdentifier(EntityMetaVar),
              undefined,
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier(EntityMetadataTy),
                undefined,
              ),
              undefined,
            ),
            ts.factory.createParameterDeclaration(
              undefined,
              undefined,
              undefined,
              ts.factory.createIdentifier(EntityObjVar),
              undefined,
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier('Omit'),
                [
                  ts.factory.createTypeReferenceNode(
                    ts.factory.createIdentifier(schema.name),
                    undefined,
                  ),
                  ts.factory.createLiteralTypeNode(
                    ts.factory.createStringLiteral(EntityMetaVar),
                  ),
                ],
              ),
              undefined,
            ),
          ],
          ts.factory.createBlock(
            [
              ts.factory.createExpressionStatement(
                ts.factory.createCallExpression(
                  ts.factory.createSuper(),
                  undefined,
                  [ts.factory.createIdentifier(EntityMetaVar)],
                ),
              ),
              ...assignments,
            ],
            true,
          ),
        ),
        ...propDecls,
      ],
    );

    ctx.addNodesToTsFile(this.output, entityClass);
  }
}
