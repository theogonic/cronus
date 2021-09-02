import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { getImportDecl } from './ts-type';
import { GContext, TsFileContext } from '../context';

export function dumpContext(ctx: GContext, outputDir: string): void {
  const { tsFiles, textFiles } = ctx;

  // handle Typescript files
  for (const filePath in tsFiles) {
    if (Object.prototype.hasOwnProperty.call(tsFiles, filePath)) {
      const fileCtx = tsFiles[filePath];

      const dstFilePath = path.join(outputDir, filePath);

      const dir = path.dirname(dstFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const tsFileContent = this.dumpTsByTsFileContext(ctx, fileCtx);

      fs.writeFileSync(dstFilePath, tsFileContent);
    }
  }

  // handle text files
  for (const filePath in textFiles) {
    if (Object.prototype.hasOwnProperty.call(textFiles, filePath)) {
      const content = textFiles[filePath];

      const dstFilePath = path.join(outputDir, filePath);

      const dir = path.dirname(dstFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(dstFilePath, content);
    }
  }
}

/**
 * Dump a list of Typescript AST node to file
 * @param nodes A list of Typescript AST node
 * @param file Absolute file path
 */
export function dumpTsByTsFileContext(
  ctx: GContext,
  fileCtx: TsFileContext,
): string {
  const sourceFile: ts.SourceFile = ts.createSourceFile(
    '',
    '',
    ts.ScriptTarget.ES2018,
    true,
    ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  let buf = '';

  // Handle import first
  for (const importPath in fileCtx.imports) {
    if (Object.prototype.hasOwnProperty.call(fileCtx.imports, importPath)) {
      const imp = fileCtx.imports[importPath];
      const importNode = getImportDecl(imp);
      const res = printer.printNode(
        ts.EmitHint.Unspecified,
        importNode,
        sourceFile,
      );
      buf += res;
      buf += '\n';
    }
  }

  for (const node of fileCtx.nodes) {
    const res = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
    buf += res;
    buf += '\n';
  }

  return buf;
}
