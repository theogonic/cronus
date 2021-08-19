import { RawTscaDef, TscaDef } from './types';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import refParser from '@apidevtools/json-schema-ref-parser';
import * as globby from 'globby';
import { GenerationConfig } from './config';

function loadYamlFromFile<T = Record<string, unknown>>(yamlFile: string): T {
  const content = fs.readFileSync(yamlFile, 'utf8');
  const raw = yaml.load(content);
  if (typeof raw != 'object') {
    throw new Error(
      `expect number, but found ${typeof raw} from yaml file '${yamlFile}'`,
    );
  }
  return raw as unknown as T;
}

export async function loadDefFromYaml(defFile?: string): Promise<TscaDef> {
  const raw = loadYamlFromFile<RawTscaDef>(defFile);
  const derefRaw = (await refParser.dereference(raw)) as RawTscaDef;
  return TscaDef.fromRaw(derefRaw, { src: defFile });
}

export async function loadDefs(globs: string[]): Promise<TscaDef[]> {
  const paths = await globby(globs, { absolute: true });
  return Promise.all(paths.map(loadDefFromYaml));
}

/**
 * Load generation cofiguration from yaml file
 */
export function loadGenerationConfig(configFile?: string): GenerationConfig {
  if (!configFile) {
    configFile = 'tsca.yaml';
  }
  const raw = loadYamlFromFile<GenerationConfig>(configFile);
  return raw;
}
