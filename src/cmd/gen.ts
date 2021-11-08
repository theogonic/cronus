import { Logger } from '@nestjs/common';
import { Command, RootCommand } from 'nestjs-eclih';
import { dumpContext } from '../util/context';
import { GContext } from '../context';
import { loadGConfig, loadDefsFromGConfig } from '../loader';
import { getInstantiatedGenerators } from '../config';
import {
  TypescriptGenerator,
  GraphQLNestJsGenerator,
  GeneralEntityGenerator,
  GraphQLSchemaGenerator,
  RestNestJsGenerator,
  RestClientGenerator,
} from '../gen';

// to trigger decorator
TypescriptGenerator;
GraphQLNestJsGenerator;
GeneralEntityGenerator;
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
        mandatory: true,
      },
    ],
  })
  async gen({ config }) {
    const gConfig = loadGConfig(config);
    const generators = getInstantiatedGenerators(gConfig);
    const defs = await loadDefsFromGConfig(gConfig);
    if (defs.length == 0) {
      throw new Error('no defs found');
    }
    const ctx = new GContext(gConfig);
    defs.forEach((def) => ctx.addTypesFromDef(def));

    generators.forEach((gnrt) => {
      gnrt.before(ctx);
      gnrt.generate(ctx, ...defs);
      gnrt.after(ctx);
    });
    dumpContext(ctx, '.');
  }
}
