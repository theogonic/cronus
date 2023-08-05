import { program } from 'commander';
import { GConfig, getInstantiatedGenerators } from './config';
import { GContext } from './context';
import {
  GaeaGenerator,
  GraphQLNestJsGenerator,
  GraphQLGenerator,
  RestClientGenerator,
  RestNestJsGenerator,
  SQLGenerator,
  TypescriptGenerator,
} from './gen';
import { autoCompleteTheogonicGaea, loadDefsFromGConfig } from './loader';
// to trigger decorator
TypescriptGenerator;
GraphQLNestJsGenerator;
GaeaGenerator;
GraphQLGenerator;
RestNestJsGenerator;
RestClientGenerator;
SQLGenerator;
import { TscaDef } from './types';
import { dumpContext } from './util/context';
import { Ohm2Tsca } from './ohm';
import * as path from 'path';
import * as fs from 'fs/promises';

program.name('zeus');

program
  .argument(
    '<fileOrDirectory>',
    "The entry file or a directory contains the default entry file 'main.api'",
  )
  .option('--dry-run')
  .action(async (fileOrDir, { dryRun }) => {
    let gConfig: GConfig = null;
    const protoTscaDef: TscaDef = null;
    let zeusTscaDef: TscaDef = null;
    const defs: TscaDef[] = [];

    let entryFilePath = null;

    try {
      const isDir = (await fs.stat(fileOrDir)).isDirectory();
      if (isDir) {
        entryFilePath = path.join(fileOrDir, 'main.api');
      } else {
        entryFilePath = fileOrDir;
      }
    } catch (err) {
      if (err.code == 'ENOENT') {
        return console.error('File not found:', fileOrDir);
      }
      return console.error('Error occurred:', err.message);
    }

    const trans = new Ohm2Tsca();
    await trans.loadZeusFile(entryFilePath);
    gConfig = trans.gconfig;
    zeusTscaDef = TscaDef.fromRaw(trans.rawTscaDef, {
      name: '',
      src: entryFilePath,
    });

    autoCompleteTheogonicGaea(gConfig);
    defs.push(...(await loadDefsFromGConfig(gConfig)));
    if (protoTscaDef) {
      defs.push(protoTscaDef);
    }
    if (zeusTscaDef) {
      defs.push(zeusTscaDef);
    }

    if (dryRun) {
      console.log(JSON.stringify(gConfig, null, 2));

      for (const def of defs) {
        console.log(JSON.stringify(def.raw, null, 2));
      }
    }

    const generators = getInstantiatedGenerators(gConfig);
    if (defs.length == 0) {
      throw new Error('no defs found');
    }
    const ctx = new GContext(gConfig);
    defs.forEach((def) => ctx.addTypesFromDef(def));

    if (dryRun) {
    } else {
      generators.forEach((gnrt) => {
        console.log(`generator '${gnrt.generatorId}' is running`);
        gnrt.before(ctx);
        gnrt.generate(ctx, ...defs);
        gnrt.after(ctx);
      });
      dumpContext(ctx, '.');
    }
  });

program.parse();
