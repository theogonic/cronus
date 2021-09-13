import { RawTscaDef, TscaDef } from './types';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import refParser from '@apidevtools/json-schema-ref-parser';
import * as globby from 'globby';
import { GConfig, GeneralEntityGeneratorConfig } from './config';

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

async function loadDefsFromGlobs(globs: string[]): Promise<TscaDef[]> {
  const paths = await globby(globs, { absolute: true });
  return Promise.all(paths.map(loadDefFromYaml));
}

export async function loadDefsFromGConfig(
  gConfig: GConfig,
): Promise<TscaDef[]> {
  const globs = [];
  const geGeneratorConfig = gConfig.generators[
    'general-entity'
  ] as GeneralEntityGeneratorConfig;
  if (geGeneratorConfig) {
    if (geGeneratorConfig.geZeusDir) {
      globs.push(`${geGeneratorConfig.geZeusDir}/**/*.yaml`);
    }
  }
  // make sure geZeusDir is first one if exist
  globs.push(...gConfig.defs);
  return loadDefsFromGlobs(globs);
}

/**
 * Load generation cofiguration from yaml file
 */
export function loadGConfig(configFile?: string): GConfig {
  if (!configFile) {
    configFile = 'tsca.yaml';
  }
  const gConfig = loadYamlFromFile<GConfig>(configFile);
  const geGeneratorConfig = gConfig.generators[
    'general-entity'
  ] as GeneralEntityGeneratorConfig;
  if (geGeneratorConfig) {
    if (!geGeneratorConfig.geZeusDir) {
      geGeneratorConfig.geZeusDir = path.dirname(
        require.resolve(
          path.normalize('@theogonic/gaea/assets/zeus/types.yaml'),
        ),
      );

      if (!fs.existsSync(geGeneratorConfig.geZeusDir)) {
        throw new Error(`cannot find zeus types dir from '@theogonic/gaea'`);
      }
    }
    if (!geGeneratorConfig.geImport) {
      geGeneratorConfig.geImport = '@theogonic/gaea';
    }
  }

  return gConfig;
}
