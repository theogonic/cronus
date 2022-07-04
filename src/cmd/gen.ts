import { Logger } from '@nestjs/common';
import { Command, RootCommand } from 'nestjs-eclih';
import { dumpContext } from '../util/context';
import { GContext } from '../context';
import {
  loadGConfig,
  loadDefsFromGConfig,
  autoCompleteTheogonicGaea,
} from '../loader';
import { getInstantiatedGenerators, GConfig } from '../config';
import {
  TypescriptGenerator,
  GraphQLNestJsGenerator,
  GaeaGenerator,
  GraphQLSchemaGenerator,
  RestNestJsGenerator,
  RestClientGenerator,
} from '../gen';
import { TscaDef } from '../types';
import { Proto2Tsca } from '../proto';

// to trigger decorator
TypescriptGenerator;
GraphQLNestJsGenerator;
GaeaGenerator;
GraphQLSchemaGenerator;
RestNestJsGenerator;
RestClientGenerator;

@Command()
export class GenCmdProvider {
  private readonly logger = new Logger(GenCmdProvider.name);

  @RootCommand({
    options: [
      {
        nameAndArgs: '--config <file>',
      },
      {
        nameAndArgs: '--proto <file>',
      },
      {
        nameAndArgs: '--dry-run',
      },
    ],
  })
  async gen({ config, proto, dryRun }) {
    let gConfig: GConfig = null;
    let protoTscaDef: TscaDef = null;
    const defs: TscaDef[] = [];
    if (config) {
      gConfig = loadGConfig(config);
    } else if (proto) {
      const trans = new Proto2Tsca();
      await trans.loadProtoFile(proto);
      gConfig = trans.gconfig;
      protoTscaDef = TscaDef.fromRaw(trans.rawTscaDef, {
        name: '',
        src: proto,
      });
    }
    autoCompleteTheogonicGaea(gConfig);
    defs.push(...(await loadDefsFromGConfig(gConfig)));
    if (protoTscaDef) {
      defs.push(protoTscaDef);
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
  }
}
