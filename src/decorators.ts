import { registerGeneratorConstructor } from './registry';

export function Register(generatorId: string): ClassDecorator {
  return function (target) {
    target.prototype.generatorId = generatorId;
    registerGeneratorConstructor(generatorId, target.prototype.constructor);
  };
}
