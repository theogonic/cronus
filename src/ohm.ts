import { GConfig } from "./config";
import { RawTscaDef, RawTscaMethod, RawTscaSchema, RawTscaUsecase, TscaDef } from "./types";
import * as fs from 'fs/promises';
import {existsSync, readFileSync} from "fs"
import * as ohm from 'ohm-js';
import { toAST } from "ohm-js/extras"
import * as path from 'path';

var grammarPath = path.resolve(__dirname, '../zeus.ohm');
export const ZeusOhmDef = readFileSync(grammarPath, {encoding: 'utf-8'});

export class Ohm2Tsca {
  gconfig: GConfig = {
    generators: {},
    defs: [],
  };
  rawTscaDef: RawTscaDef = {
    types: {},
    usecases: {},
    schemas: {},
  };
  grammar:ohm.Grammar ;
  private includePaths: Set<string>
  constructor(includePaths:string[] = [], private resolveImport = true){
    this.grammar = ohm.grammar(ZeusOhmDef);
    this.includePaths = new Set(includePaths);

  }

  async loadZeusFile(file: string, fromFile:string = null): Promise<void> {
    let finalFile = null;
    if (existsSync(file)){
      finalFile = file
    } else {
      if(!path.isAbsolute(file)){
        // try fromFile's relative first
        if(fromFile){
          const rel = path.dirname(fromFile)
          const candidate = path.join(rel, file)
          if(existsSync(candidate)){
            finalFile = candidate
          }
        }
        
  
        if(!finalFile) {
          // then try include paths
          for(const p of this.includePaths){
            const candidate = path.join(p, file);
            if(existsSync(candidate)){
              finalFile = candidate
              break;
            }
          }
        }
        
      }
    }

    
    if(!finalFile){
      throw new Error(`cannot find ${file}`)
    }

    const content = await fs.readFile(finalFile, 'utf8');
    const m = this.grammar.match(content);
    if(m.failed()){
      throw new Error(m.message)
    }
    const ast:any = toAST(m)
    const imports = ohmAST2Imports(ast);
    const handleImports = imports.map(imp => this.loadZeusFile(imp, finalFile));
    await Promise.all(handleImports);
    ohmAST2RawZeusDef(ast, this.rawTscaDef);
  }
}

export function ohmAST2Imports(ast: Record<string, any>): string[] {
  const importDefs:string[] = ast["0"].filter(item=>typeof item === "string");
  return importDefs.map(item=>item.substring(1, item.length-1))
}

export function ohmAST2RawZeusDef(ast: Array<Record<string, any>>, rawdef: RawTscaDef) {
    const items = ast["0"]
    const structDefs = items.filter(item=>typeof item ==="object" && item.type == "StructDef");
    const svcDefs = items.filter(item=>typeof item ==="object" && item.type == "ServiceDef");
    const optDefs = items.filter(item=>typeof item ==="object" && item.type == "OptionDef");

    structDefs.forEach(item=> {
      const structName = item["2"]
      rawdef.types[structName] = ohmStructDef2RawZeusTscaSchema(item);
    });


    svcDefs.forEach(item => {
      const svcName = item["2"]
      rawdef.usecases[svcName] = ohmServiceDef2RawZeusUsecase(item, rawdef.types);
    });
}

function ohmServiceDef2RawZeusUsecase(ast: Record<string, any>, tyCtx: Record<string, RawTscaSchema>): RawTscaUsecase {
    const rawu: RawTscaUsecase = {
      methods: {}
    };
    if(ast.type != "ServiceDef"){
        throw new Error(`got ${ast.type}, expect ServiceDef`)
    }
    console.log("service def", ast)
    const body = ast["4"]
    for(const method of body["0"]) {
      const mName = method["1"];
      const m = ohmServiceDef2RawZeusMethod(method, tyCtx)
      rawu.methods[mName] = m;
    }
   
    return rawu;
}

function ohmServiceDef2RawZeusMethod(ast: Record<string, any>, tyCtx: Record<string, RawTscaSchema>): RawTscaMethod {
  if(ast.type != "MethodDef"){
    throw new Error(`got ${ast.type}, expect MethodDef`)
  }
  console.log("MethodDef", ast)

  const raw: RawTscaMethod = {};
  
  const reqTy = ast["3"]
  const resTy = ast["6"]

  // has to be string
  // tyCtx has to have the key
  if(reqTy){
    raw.req = tyCtx[reqTy]

  }

  if(resTy){
    raw.res = tyCtx[resTy]

  }
  
  
  return raw;
}

function ohmStructBody2RawZeusTscaSchema(body: Record<string, any>, schema:RawTscaSchema) {
  if(body.type != "StructBody"){
    throw new Error(`got ${body.type}, expect StructBody`)
  }
    const fields = body["0"]
    for (const field of fields) {
      const name:string = field["2"]
      const type:string = field["1"]
      const propSchema:RawTscaSchema = {}
      if(type.endsWith("[]")) {
        propSchema.items = {
          type: type.substring(0, type.length-2)
        }
      } else {
        propSchema.type = type
      }
      schema.properties[name] = propSchema
    }
}
function ohmStructDef2RawZeusTscaSchema(ast: Record<string, any>): RawTscaSchema {
    if(ast.type != "StructDef"){
      throw new Error(`got ${ast.type}, expect StructDef`)
    }
    const schema:RawTscaSchema = {
      properties: {}
    }
    const body = ast["4"]
    ohmStructBody2RawZeusTscaSchema(body, schema)
    return schema
}