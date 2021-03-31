import { Logger } from '@nestjs/common';
import { Command, CommandProvider } from 'nestjs-eclih';
import { UsecaseParser } from '../ur';
import * as ts from 'typescript';
import { RestNestjsUsecaseGenerator } from '../rest-nestjs';

@CommandProvider()
export class GenCmdProvider {
  private readonly logger = new Logger(GenCmdProvider.name);

  constructor() {}

  @Command({
    nameAndArgs: 'gen <FILE>',
  })
  buildCodeResource(fileName: string) {
    const parser = new UsecaseParser();
    const context = parser.parse([fileName]);
    console.log(JSON.stringify(context, null, 2));
    // const generator = new RestNestjsUsecaseGenerator();
    // const node = generator.genTsUsecaseParam({
    //   name: 'abc',
    //   properties: {},
    // });
    // const resultFile = ts.createSourceFile(
    //   'someFileName.ts',
    //   '',
    //   ts.ScriptTarget.Latest,
    //   /*setParentNodes*/ false,
    //   ts.ScriptKind.TS,
    // );
    // const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

    // const result = printer.printNode(ts.EmitHint.Unspecified, node, resultFile);
    // console.log(result);
  }
}
