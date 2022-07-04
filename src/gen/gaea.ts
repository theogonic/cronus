import { GContext } from 'src/context';
import { TscaDef, TscaSchema } from 'src/types';
import { Generator } from './base';
import { Register } from '../decorators';
import * as ts from 'typescript';
import { GaeaGeneratorConfig } from 'src/config';

const EntityToExtendTy = 'BaseGeneralObject';
const BaseDaoTy = 'BaseGeneralObjectDao';
const EntityMetaVar = 'meta';
const EntityObjVar = 'obj';
const gaeaImport = '@theogonic/gaea';

@Register('gaea')
export class GaeaGenerator extends Generator<GaeaGeneratorConfig> {
  public before(ctx: GContext) {}
  public after(ctx: GContext) {}
  protected genTscaDef(ctx: GContext, def: TscaDef) {
    this.initImport(ctx);
    def.types
      .filter((ty) => ty.gen?.['gaea'] !== undefined)
      .forEach((ty) => {
        this.genGeneralEntity(ctx, ty);
        this.genGeneralEntityDao(ctx, ty);
      });
  }

  initImport(ctx: GContext) {
    ctx.addImportsToTsFile(this.output, {
      items: [EntityToExtendTy, BaseDaoTy],
      from: gaeaImport,
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

  private getGeneralEntityDao(schema: TscaSchema): string {
    return this.getGeneralEntityTy(schema) + 'Dao';
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

  genGeneralEntityDao(ctx: GContext, schema: TscaSchema): void {
    const daoDecl = ts.factory.createClassDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createIdentifier(this.getGeneralEntityDao(schema)),
      undefined,
      [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ts.factory.createExpressionWithTypeArguments(
            ts.factory.createIdentifier(BaseDaoTy),
            [
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier(this.getGeneralEntityTy(schema)),
                undefined,
              ),
            ],
          ),
        ]),
      ],
      [
        ts.factory.createPropertyDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier('target'),
          undefined,
          undefined,
          ts.factory.createIdentifier(this.getGeneralEntityTy(schema)),
        ),
      ],
    );

    ctx.addNodesToTsFile(this.output, daoDecl);
  }

  genGeneralEntity(ctx: GContext, schema: TscaSchema): void {
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
      [ts.factory.createToken(ts.SyntaxKind.ExportKeyword)],
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
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createTypeReferenceNode(
                  ts.factory.createIdentifier(EntityToExtendTy),
                  undefined,
                ),
                ts.factory.createLiteralTypeNode(
                  ts.factory.createStringLiteral(EntityMetaVar),
                ),
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
