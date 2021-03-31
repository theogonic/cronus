import { BaseGeneratorConfig } from 'src/config';
import { Generator } from './gen/base';

// generator id => generator constructor
const generatorRegistry = {};

export function getGeneratorConstructorById(
  gId: string,
): new <T extends BaseGeneratorConfig>(config: T) => Generator {
  if (!(gId in generatorRegistry)) {
    throw new Error(`cannot find generator with id '${gId}'`);
  }

  return generatorRegistry[gId];
}

export function registerGeneratorConstructor(
  gId: string,
  generator: new (...args)=>Generator,
): void {
  if (gId in generatorRegistry) {
    throw new Error(`generator with id '${gId}' already existed.`);
  }
  generatorRegistry[gId] = generator;
}
