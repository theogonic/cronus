import { BaseGeneratorConfig } from '../config';
import { GContext } from '../context';
import { Register } from '../decorators';
import { TscaDef, TscaSchema } from '../types';
import { Generator } from './base';
import { isPrimitiveType } from './utils';

interface AngularFormGeneratorConfig extends BaseGeneratorConfig {
  // format: service.method
  methodSelectors: string[];
}

interface AngularFormGeneratorExtension {
  schemaDeps: string[];
  generatedSchemas: string[];
}

@Register('angular_form')
export class AngularFormGenerator extends Generator<AngularFormGeneratorConfig> {
  protected genTscaDef(ctx: GContext, def: TscaDef) {

    const reqsToGen: TscaSchema[] = [];
    for (const svc of def.usecases) {
      for (const m of svc.methods) {
        if (m.req.gen?.angular_form) {
          reqsToGen.push(m.req);
        }
      }
    }

    reqsToGen
      .map((req) => this.genAngularFormFuncFromTscaSchema(ctx, req))
      .forEach((str) => {
        ctx.addStrToTextFile(this.config.output, str);
      });
  }

  private genAngularFormBuilderCall(
    ctx: GContext,
    schema: TscaSchema,
    fbVar: string,
  ): string {
    let call = `${fbVar}.group({`;

    for (const chProp of schema.properties) {
      call += `${chProp.name} : ${this.genAngularFormCtl(ctx, chProp, fbVar)},\n`;
    }

    call += '\n});\n';

    return call;
  }

  private genAngularFormCtl(
    ctx: GContext,
    schema: TscaSchema,
    fbVar: string,
  ): string {
    const ext = ctx.genExt['angular_form'] as AngularFormGeneratorExtension;

    if (isPrimitiveType(schema.type)) {
      return `[null, []]`;
    } else if (ctx.isTypeEnum(schema.type)) {
      return `[null, []]`;
    }
    else {
      if (!ext.schemaDeps.includes(schema.type)) {
        ext.schemaDeps.push(schema.type);
      }

      return `get${schema.type}Form(${fbVar})`;
    }
  }

  private genAngularFormFuncFromTscaSchema(
    ctx: GContext,
    schema: TscaSchema,
  ): string {
    const ext = ctx.genExt['angular_form'] as AngularFormGeneratorExtension;
    ext.generatedSchemas.push(schema.type);

    const funcName = `get${schema.name}Form`;

    const func = `export function ${funcName}(fb: FormBuilder) {
        const form = ${this.genAngularFormBuilderCall(ctx, schema, 'fb')}
        return form;
}\n`;

    return func;
  }


  public before(ctx: GContext) {
    ctx.addStrToTextFile(
      this.config.output,
      `import { FormBuilder, FormGroup, Validators } from '@angular/forms';\n`,
    );

    ctx.genExt['angular_form'] = {
      schemaDeps: [],
      generatedSchemas: [],
    } as AngularFormGeneratorExtension;

    ctx.isTypeEnum;
  }

  public after(ctx: GContext) {
    const ext = ctx.genExt['angular_form'] as AngularFormGeneratorExtension;

    while (ext.schemaDeps.length > 0) {
      const schemaName = ext.schemaDeps.pop();
      const schema = ctx.getTypeSchemaByName(schemaName);
      const str = this.genAngularFormFuncFromTscaSchema(ctx, schema);
      ctx.addStrToTextFile(this.config.output, str);
    }
  }
}
