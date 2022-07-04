import refParser from '@apidevtools/json-schema-ref-parser';
import * as fs from 'fs';
import * as globby from 'globby';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { GConfig, GaeaGeneratorConfig } from './config';
import { Proto2Tsca } from './proto';
import { RawTscaDef, TscaDef } from './types';

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

export async function loadDefFromPath(path: string): Promise<TscaDef> {
  if (path.endsWith('.proto')) {
    const trans = new Proto2Tsca();
    await trans.loadProtoFile(path);
    return TscaDef.fromRaw(trans.rawTscaDef, {
      name: '',
      src: path,
    });
  } else {
    return loadDefFromYaml(path);
  }
}

async function loadDefsFromGlobs(globs: string[]): Promise<TscaDef[]> {
  const paths = await globby(globs, { absolute: true });
  return Promise.all(paths.map(loadDefFromPath));
}

export async function loadDefsFromGConfig(
  gConfig: GConfig,
): Promise<TscaDef[]> {
  return loadDefsFromGlobs(gConfig.defs);
}

export function autoCompleteTheogonicGaea(gConfig: GConfig) {
  const gaeaeGeneratorConfig = gConfig.generators[
    'gaea'
  ] as GaeaGeneratorConfig;
  if (gaeaeGeneratorConfig) {
    const parentDir = path.dirname(
      require.resolve(path.normalize('@theogonic/gaea/package.json')),
    );
    let gaeaZeus = path.join(parentDir, 'assets/zeus/main.proto');
    if (fs.existsSync(gaeaZeus)) {
      gConfig.defs.push(gaeaZeus);
    } else {
      gaeaZeus = path.join(parentDir, 'assets/zeus/types.yaml');
      if (!fs.existsSync(gaeaZeus)) {
        throw new Error(`cannot find zeus types dir from '@theogonic/gaea'`);
      }
    }

    gConfig.defs.push(gaeaZeus);
  }
}

/**
 * Load generation cofiguration from yaml file
 */
export function loadGConfig(configFile?: string): GConfig {
  if (!configFile) {
    configFile = 'tsca.yaml';
  }
  const gConfig = loadYamlFromFile<GConfig>(configFile);
  return gConfig;
}
