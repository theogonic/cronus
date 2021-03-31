import * as ts from 'typescript';

export function createImport(
  names: string[],
  from: string,
): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports(
        names.map((name) =>
          ts.factory.createImportSpecifier(
            undefined,
            ts.factory.createIdentifier(name),
          ),
        ),
      ),
    ),
    ts.factory.createStringLiteral(from),
  );
}
