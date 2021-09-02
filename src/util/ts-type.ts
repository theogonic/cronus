import { TsImport } from '../context';
import * as ts from 'typescript';

export function getImportDecl(imp: TsImport): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    undefined,
    ts.factory.createImportClause(
      false,
      imp.default ? ts.factory.createIdentifier(imp.default) : undefined,
      ts.factory.createNamedImports(
        imp.items.map((name) =>
          ts.factory.createImportSpecifier(
            undefined,
            ts.factory.createIdentifier(name),
          ),
        ),
      ),
    ),
    ts.factory.createStringLiteral(imp.from),
  );
}
