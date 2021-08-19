import { Generator } from './gen/base';
import { getGeneratorConstructorById } from './registry';

export interface GConfig {
  defs: string[];
  generators: Record<string, BaseGeneratorConfig>;
}

export interface BaseGeneratorConfig {
  output: string;
}

export interface GeneralEntityGeneratorConfig extends BaseGeneratorConfig {
  geImport: string;
  geZeusDir: string;
  tsTypeImport: string;
}

export function getInstantiatedGenerators(config: GConfig): Generator[] {
  const generators = [];

  if (config.generators) {
    for (const gId in config.generators) {
      if (Object.prototype.hasOwnProperty.call(config.generators, gId)) {
        const genConfig = config.generators[gId];
        const genConstructor = getGeneratorConstructorById(gId);
        const gen = new genConstructor(genConfig);
        generators.push(gen);
      }
    }
  }

  return generators;
}
