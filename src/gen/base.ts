import { Logger } from '@nestjs/common';
import * as _ from 'lodash';
import * as ts from 'typescript';
import { BaseGeneratorConfig } from '../config';
import { GContext } from '../context';
import { TscaDef, TscaMethod, TscaSchema, TscaUsecase } from '../types';

export abstract class Generator<
  C extends BaseGeneratorConfig = BaseGeneratorConfig,
> {
  public readonly generatorId: string;
  protected readonly logger = new Logger(
    Object.getPrototypeOf(this).constructor.name,
  );

  protected abstract genTscaDef(ctx: GContext, def: TscaDef);

  // before will be called before `generate`
  public abstract before(ctx: GContext);

  // after will be called after `generate`
  public abstract after(ctx: GContext);

  constructor(protected readonly config: C) {}

  public generate(ctx: GContext, ...defs: TscaDef[]): void {
    defs.forEach((def) => this.genTscaDef(ctx, def));
  }

  get output(): string {
    return this.config.output;
  }

  /**
   * User => null, User
   * core.User => core, User
   * wnl.core.User => wnl.core, User
   * @param type custom type with namespace
   */
  protected getNamespaceAndTypeFromUserDefinedType(
    type: string,
  ): [string, string] {
    const idx = type.lastIndexOf('.');
    if (idx == -1) {
      return [null, type];
    }
    return [type.substring(0, idx), type.substring(idx + 1)];
  }

  protected getUsecaseInstanceVarName(u: TscaUsecase): string {
    return _.camelCase(this.getUsecaseTypeName(u));
  }

  protected getUsecaseTypeName(usecase: TscaUsecase) {
    return _.upperFirst(usecase.name);
  }

  protected getUsecaseTypeTokenName(usecase: TscaUsecase) {
    const usecaseType = this.getUsecaseTypeName(usecase);
    return _.toUpper(_.snakeCase(usecaseType));
  }

  protected handleUserDefinedSchemaType(
    ctx: GContext,
    file: string,
    typeWithNamespace: string,
    overrideTypeName: string,
  ): ts.TypeReferenceNode {
    const [ns, type] =
      this.getNamespaceAndTypeFromUserDefinedType(typeWithNamespace);
    const dstTypeName = overrideTypeName || type;
    // ctx.addImportsToTsFile(file, {
    //   items: [dstTypeName],
    //   from: this.getNamespaceTypeImport(ns),
    // });
    return ts.factory.createTypeReferenceNode(dstTypeName, undefined);
  }

  getTscaMethodRequestTypeName(method: TscaMethod): string {
    return _.upperFirst(method.name) + 'Request';
  }

  getTscaMethodResponseTypeName(method: TscaMethod): string {
    return _.upperFirst(method.name) + 'Response';
  }

  protected genEnumFromSchema(schema: TscaSchema): ts.EnumDeclaration {
    if (!schema.enum) {
      throw new Error(
        `expect type of '${schema.name}' is enum, but '${schema.type}'`,
      );
    }

    if (schema.parent) {
      throw new Error(
        'anonymous enum (defined in properties of a type) is not allowed',
      );
    }

    const members = schema.enum.map((em) => {
      let initializer: ts.Expression;
      if (em.value) {
        if (typeof em.value == 'string') {
          initializer = ts.factory.createStringLiteral(em.value);
        } else if (typeof em.value == 'number') {
          initializer = ts.factory.createNumericLiteral(em.value);
        }
      }
      return ts.factory.createEnumMember(em.name, initializer);
    });

    return ts.factory.createEnumDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      schema.name,
      members,
    );
  }

  protected getTsTypeNodeFromSchemaWithType(
    ctx: GContext,
    file: string,
    schema: TscaSchema,
    overrideName: string,
  ): ts.TypeNode {
    if (schema.enum && schema.parent) {
      throw new Error(
        'anonymous enum (defined in properties of a type) is not allowed',
      );
    }

    switch (schema.type) {
      case 'string':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      case 'number':
      case 'float':
      case 'i32':
      case 'int32':
      case 'integer':
        if (schema.enum && schema.parent) {
          throw new Error(
            'anonymous enum (defined in properties of a type) is not allowed',
          );
        }
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      case 'bool':
      case 'boolean':
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
      case 'object':
        if (schema.parent) {
          throw new Error('anonymous object decleration is not allowed');
        }
        break;
      case 'array':
        if (!schema.items) {
          throw new Error(`missing items for type '${schema.name}'`);
        }
        if (!schema.items.type) {
          throw new Error(`missing items's type for '${schema.name}'`);
        }
        const itemType = this.getTsTypeNodeFromSchemaWithType(
          ctx,
          file,
          schema.items,
          overrideName,
        );
        return ts.factory.createArrayTypeNode(itemType);

      default:
        return this.handleUserDefinedSchemaType(
          ctx,
          file,
          schema.type,
          overrideName,
        );
    }
  }
}
