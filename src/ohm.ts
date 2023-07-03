import { GConfig } from "./config";
import { RawTscaDef, RawTscaMethod, RawTscaSchema, RawTscaUsecase, TscaDef } from "./types";
import * as fs from 'fs/promises';
import {existsSync, readFileSync} from "fs"
import * as ohm from 'ohm-js';
import * as path from 'path';



let grammarPath = path.resolve(__dirname, '../zeus.ohm');;

if(!existsSync(grammarPath)){
  const requireZeusOhmPath = path.join(path.dirname(
    require.resolve(path.normalize('@theogonic/zeus/package.json')),
  ), "zeus.ohm");
  grammarPath = requireZeusOhmPath;
}

export const ZeusOhmDef = readFileSync(grammarPath, {encoding: 'utf-8'});
export const grammar = ohm.grammar(ZeusOhmDef);
export const semantics = grammar.createSemantics();

semantics.addOperation('parse', {
  File: (list1) => {
    return list1.children.map(c => c.parse());
  },
  ImportDef: (_1, s) => {
    return {
      "type": "ImportDef",
      "value":  s.sourceString.substring(1, s.sourceString.length -1)
    }
  },
  OptionDef: (_1, name, _3, value, _5) => {
    return {
      "type": "OptionDef",
      "name": name.sourceString,
      "value": value.numChildren > 0 ? JSON.parse(value.children[0].sourceString) : true
    }
  },
  GlobalOptionDef: (op, _2) => {
    return {
      "type": "GlobalOptionDef",
      "def": op.parse()
    }
  },
  EnumDef: (ops, _2, name, _4, fields, _6, _7) => {
    return {
      "type": "EnumDef",
      "name": name.sourceString,
      "enums": fields.children.map(f => f.parse()),
      "options": ops.children.map(op => op.parse()),
    }
  },
  EnumField: (ops, name, _3, val) => {
    return {
      "name": name.sourceString,
      "value": parseInt(val.sourceString,10)
    }
  },
  MethodDef: (ops, name, _3, _4, _5, reqBody, _7, _8, _9, resBody, _11, _12)=>{
    return {
      "name":  name.sourceString,
      "req": reqBody.sourceString.length > 0 ? reqBody.children[0].parse() : [],
      "res": resBody.sourceString.length > 0 ? resBody.children[0].parse() : [],
      "options": ops.children.map(op => op.parse())
    }
  },
  StructDef: (ops, _2, name, _4, body, _5) => {
    return {
      "type": "StructDef",
      "name":  name.sourceString,
      "options": ops.children.map(op => op.parse()),
      "fields": body.parse()
    }
  },
  StructBody:(fields, _2) => {
    return fields.children.map(f => f.parse());
  },
  StructField: (ops, ty, name)=> {
    return {
      "options": ops.children.map(op => op.parse()),
      "type": ty.sourceString,
      "name": name.sourceString
    }
  },
  ServiceDef: (ops, _2, name, _4, body, _5) => {
    return {
      "type": "ServiceDef",
      "name":  name.sourceString,
      "options": ops.children.map(op => op.parse()),
      "methods": body.parse()
    }
  },
  ServiceBody: (ms) => {
    return ms.children.map(c=>c.parse())
  },

  Object_empty: function (_1, _2) { return {}; },
  Object_nonEmpty: function (_1, x, _3, xs, _5) {
    var out = {};
    var k = x.children[0].parse();
    var v = x.children[2].parse();
    out[k] = v;
    for (var i = 0; i < xs.children.length; i++) {
      var c = xs.children[i];
      k = c.children[0].parse();
      v = c.children[2].parse();
      out[k] = v;
    }
    return out;
  },
  Array_empty: function (_1, _2) {
    return [];
  },
  Array_nonEmpty: function (_1, x, _3, xs, _5) {
    var out = [x.parse()];
    for (var i = 0; i < xs.children.length; i++) {
      out.push(xs.children[i].parse());
    }
    return out;
  },
  stringLiteral: function (_1, e, _3) {
    // TODO would it be more efficient to try to capture runs of unescaped
    // characters directly?
    return e.children.map(function (c) { return c.parse(); }).join("");
  },
  doubleStringCharacter_nonEscaped: function (e) {
    return e.interval.contents;
  },
  doubleStringCharacter_escaped: function (_, e) {
    return e.parse();
  },
  escapeSequence_doubleQuote: function (e) { return '"'; },
  escapeSequence_reverseSolidus: function (e) { return '\\'; },
  escapeSequence_solidus: function (e) { return '/'; },
  escapeSequence_backspace: function (e) { return '\b'; },
  escapeSequence_formfeed: function (e) { return '\f'; },
  escapeSequence_newline: function (e) { return '\n'; },
  escapeSequence_carriageReturn: function (e) { return '\r'; },
  escapeSequence_horizontalTab: function (e) { return '\t'; },
  escapeSequence_codePoint: function (_, e) {
    return String.fromCharCode(parseInt(e.interval.contents, 16));
  },
  Number: function (e) { return parseFloat(e.interval.contents); },
  True: function (e) { return true; },
  False: function (e) { return false; },
  Null: function (e) { return null; }
});


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
  private includePaths: Set<string>
  constructor(includePaths:string[] = [], private resolveImport = true){
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
    const m = grammar.match(content);
    if(m.failed()){
      throw new Error(m.message)
    }
    const defs:Record<string, any>[] = semantics(m).parse();
    const imports = ohmAST2Imports(defs);
    const handleImports = imports.map(imp => this.loadZeusFile(imp, finalFile));
    await Promise.all(handleImports);
    ohmAST2RawZeusDef(defs, this.rawTscaDef, this.gconfig);
  }
}

export function ohmAST2Imports(items: Array<Record<string, any>>): string[] {
  const importDefs = items.filter(item=>item["type"] === "ImportDef");
  return importDefs.map(item=>item["value"])
}


export function ohmAST2RawZeusDef(items: Array<Record<string, any>>, rawdef: RawTscaDef, gconfig: GConfig) {
    const structDefs = items.filter(item=> item.type == "StructDef");
    const svcDefs = items.filter(item=> item.type == "ServiceDef");
    const optDefs = items.filter(item=> item.type == "GlobalOptionDef");
    const enumDefs = items.filter(item=> item.type == "EnumDef");

    enumDefs.forEach(item => {
      const name = item["name"];
      rawdef.types[name] = ohmEnumDef2RawSchema(item);
    });

    structDefs.forEach(item=> {
      const name = item["name"]
      rawdef.types[name] = ohmStructDef2RawZeusTscaSchema(item);
    });

    

    svcDefs.forEach(item => {
      const svcName = item["name"]
      rawdef.usecases[svcName] = ohmServiceDef2RawZeusUsecase(item, rawdef.types);
    });

    optDefs.forEach(globalOp => {
      gconfig.generators[globalOp.def["name"]] = globalOp.def["value"]
    })
    
}

function ohmServiceDef2RawZeusUsecase(ast: Record<string, any>, tyCtx: Record<string, RawTscaSchema>): RawTscaUsecase {
    const rawu: RawTscaUsecase = {
      methods: {},
      gen:  ohmOptionDefs2Obj(ast["options"])
    };
    if(ast.type != "ServiceDef"){
        throw new Error(`got ${ast.type}, expect ServiceDef`)
    }
    const methods = ast["methods"]
    for(const method of methods) {
      const mName = method["name"];
      const m = ohmServiceDef2RawZeusMethod(method, tyCtx)
      rawu.methods[mName] = m;
    }
   
    return rawu;
}

function ohmServiceDef2RawZeusMethod(ast: Record<string, any>, tyCtx: Record<string, RawTscaSchema>): RawTscaMethod {
  const raw: RawTscaMethod = {
    gen: ohmOptionDefs2Obj(ast["options"])
  };
  const reqTy = ast["req"]
  const resTy = ast["res"]


  if(typeof reqTy == "string"){
    raw.req = tyCtx[reqTy];

    // the method req only need to used once
    delete tyCtx[reqTy];
  } 
  else if(Array.isArray(reqTy)){
    raw.req = {
      properties: {}
    }

    ohmStructBody2RawZeusTscaSchema({
      "fields": reqTy
    }, raw.req)
  }

  

  if(typeof resTy == "string"){
    raw.res = tyCtx[resTy]
    // the method req only need to used once
    delete tyCtx[resTy];
  } else if(typeof resTy == "object") {
    raw.res = {
      properties: {}
    };
    ohmStructBody2RawZeusTscaSchema({
      "fields": resTy
    }, raw.res)

  }
  
  
  return raw;
}

function ohmStructBody2RawZeusTscaSchema(body: Record<string, any>, schema:RawTscaSchema) {

    const fields = body["fields"]
    for (const field of fields) {
      const name:string = field["name"]
      const type:string = field["type"]
      const propSchema:RawTscaSchema = {}
      if(type.endsWith("[]")) {
        propSchema.type = "array";
        propSchema.items = {
          type: type.substring(0, type.length-2)
        }
      } else {
        propSchema.type = type
      }
      propSchema.gen = ohmOptionDefs2Obj(field["options"])
      schema.properties[name] = propSchema
    }
}
function ohmStructDef2RawZeusTscaSchema(ast: Record<string, any>): RawTscaSchema {
    if(ast.type != "StructDef"){
      throw new Error(`got ${ast.type}, expect StructDef`)
    }
    const schema:RawTscaSchema = {
      properties: {},
      gen:  ohmOptionDefs2Obj(ast["options"])
    }

    ohmStructBody2RawZeusTscaSchema(ast, schema)
    return schema
}

function ohmEnumDef2RawSchema(ast: Record<string, any>): RawTscaSchema {
  if(ast.type != "EnumDef"){
    throw new Error(`got ${ast.type}, expect StructDef`)
  }
  const schema:RawTscaSchema = {
    enum: ast["enums"],
    gen:  ohmOptionDefs2Obj(ast["options"])
  }
  return schema;
}

function ohmOptionDefs2Obj(ops: Array<Record<string, any>>): Record<string, any> {
  const obj = {};
  for (const op of ops) {
    obj[op["name"]] = op["value"]
  }
  return obj;
}