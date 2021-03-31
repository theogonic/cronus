import { registerGeneratorConstructor } from './registry';

export function Register(generatorId: string): ClassDecorator {
  return function (target) {
    registerGeneratorConstructor(generatorId, target.prototype.constructor);
  };
}
