import { Logger } from "@nestjs/common";
import { Command } from "nestjs-eclih";
import { Ohm2Tsca } from "../ohm";
import * as yaml from 'js-yaml';

@Command()
export class DumpCmdProvider {
  private readonly logger = new Logger(DumpCmdProvider.name);

  @Command({
    options: [
      {
        nameAndArgs: '--zeus <file>',
      }
    ]
  })
  async dump({ zeus}) {
    const o2t = new Ohm2Tsca()
    await o2t.loadZeusFile(zeus)
    const yamlstr = yaml.dump(o2t.rawTscaDef, {indent: 2})
    console.log(yamlstr)
  }

}