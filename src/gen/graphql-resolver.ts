import * as ts from 'typescript';
import { GContext } from '../context';
import { Register } from '../decorators';
import {
    TscaDef,
    TscaMethod,
    TscaUsecase,
} from '../types';
import * as _ from 'lodash';
import { Generator } from './base';
import { BaseGeneratorConfig } from 'src/config';

interface GraphQLResolverGeneratorConfig extends BaseGeneratorConfig {
    tsTypeImport: string;
}

@Register('gql-resolver')
export class GraphQLResolverGenerator extends Generator<GraphQLResolverGeneratorConfig> {
    public before(ctx: GContext) {
        ctx.addImportsToTsFile(
            this.output,
            {
                from: '@nestjs/common',
                items: [
                    'Inject',
                    'Logger'
                ],
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
                    'ResolveReference'
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
        def.usecases.filter((u) => u.gen?.resolver).map((u) => this.genTscaUsecase(ctx, u));
    }

    private genTscaUsecase(ctx: GContext, u: TscaUsecase): void {
        // Import types and services 
        ctx.addImportsToTsFile(this.output, {
            from: this.config.tsTypeImport,
            items: [this.getUsecaseTypeName(u), this.getUsecaseTypeTokenName(u), u.gen?.resolver.invokerType],
        });

        // Generate resolver methods
        // TODO: Add method that reads types.gen.gql.properties and generates @ResolveField() methods
        const methodNodes = u.methods
            .filter((m) => m.gen?.gql)
            .map((m) => this.genTscaMethod(ctx, u, m));

        // Create resolver class
        const node = ts.factory.createClassDeclaration(
            [ts.factory.createDecorator(ts.factory.createCallExpression(
                ts.factory.createIdentifier("Resolver"),
                undefined,
                []
            ))],
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            ts.factory.createIdentifier(_.upperFirst(u.name) + "Resolver"),
            undefined,
            undefined,
            [
                ts.factory.createConstructorDeclaration(
                    undefined,
                    undefined,
                    [
                        ts.factory.createParameterDeclaration(
                            [ts.factory.createDecorator(ts.factory.createCallExpression(
                                ts.factory.createIdentifier("Inject"),
                                undefined,
                                [ts.factory.createIdentifier(
                                    this.getUsecaseTypeTokenName(u)
                                )]
                            ))],
                            [
                                ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword),
                                ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)
                            ],
                            undefined,
                            ts.factory.createIdentifier(
                                this.getUsecaseInstanceVarName(u)
                            ),
                            undefined,
                            ts.factory.createTypeReferenceNode(
                                ts.factory.createIdentifier(
                                    this.getUsecaseTypeName(u)
                                ),
                                undefined
                            ),
                            undefined
                        ),
                    ],
                    ts.factory.createBlock(
                        [],
                        false
                    )
                ),
                ...methodNodes // Add all the resolver methods
            ]
        )
        ctx.addNodesToTsFile(this.output, node)
    }

    private genTscaMethod(ctx: GContext, u: TscaUsecase, method: TscaMethod): ts.MethodDeclaration {
        const node = ts.factory.createMethodDeclaration(
            [ts.factory.createDecorator(ts.factory.createCallExpression(
                ts.factory.createIdentifier(_.upperFirst(method.gen.gql.type)),
                undefined,
                []
            ))],
            [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
            undefined,
            ts.factory.createIdentifier(method.name),
            undefined,
            undefined,
            [
                ts.factory.createParameterDeclaration(
                    [ts.factory.createDecorator(ts.factory.createCallExpression(
                        ts.factory.createIdentifier("Context"),
                        undefined,
                        [ts.factory.createStringLiteral(u.gen.resolver.invokerContext)]
                    ))],
                    undefined,
                    undefined,
                    ts.factory.createIdentifier("invoker"),
                    undefined,
                    ts.factory.createTypeReferenceNode(
                        ts.factory.createIdentifier(u.gen.resolver.invokerType),
                        undefined
                    ),
                    undefined
                ),
                ts.factory.createParameterDeclaration(
                    [ts.factory.createDecorator(ts.factory.createCallExpression(
                        ts.factory.createIdentifier("Args"),
                        undefined,
                        [ts.factory.createStringLiteral("request")]
                    ))],
                    undefined,
                    undefined,
                    ts.factory.createIdentifier("request"),
                    undefined,
                    undefined,
                    undefined
                )
            ],
            undefined,
            ts.factory.createBlock(
                [ts.factory.createReturnStatement(ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createThis(),
                            ts.factory.createIdentifier(
                                this.getUsecaseInstanceVarName(u)
                            )
                        ),
                        ts.factory.createIdentifier(method.name)
                    ),
                    undefined,
                    [ts.factory.createObjectLiteralExpression(
                        [
                            ts.factory.createShorthandPropertyAssignment(
                                ts.factory.createIdentifier("invoker"),
                                undefined
                            ),
                            ts.factory.createSpreadAssignment(ts.factory.createIdentifier("request"))
                        ],
                        true
                    )]
                ))],
                true
            )
        )
        return node
    }

}