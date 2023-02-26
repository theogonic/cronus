import { RawTscaDef, RawTscaUsecase, TscaDef } from "./types";

export const ZeusOhmDef = `
Zeus {
    File = (
      ImportDef
      | ServiceDef
      | OptionDef
      | StructDef<"struct">)*
    
    ImportDef
      = "import" path
    
    OptionDef
      = "option" ident ("{" OptionBody "}")?
   
    OptionBody
      = OptionField *
    
    OptionField
      = ident ( ( ident ("," ident)*) | ("{" OptionBody "}") )? // either single value, list, or map
    
    MethodDef
      = ident ("{" MethodBody "}")?
    MethodBody
      =  ( "in" (ident | AnonStructDef) )? ("out" (ident | AnonStructDef))? OptionDef*
 
    AnonStructDef = "{" StructBody "}"
    
    StructDef<key>
      = key ident "{" StructBody "}"
    StructBody
      = OptionDef* StructField*
    StructField
      = ident ident ("{" StructFieldBody "}")?
    StructFieldBody 
      = (OptionDef)*
 
    ServiceDef
      = "service" ident "{" ServiceBody "}"
    ServiceBody
      = (MethodDef
      | OptionDef)*
 
 
    ident  (an identifier)
      = letter alnum*

    path
     = (letter | "/" | "\\\\" | ".")+
 }
`

export function ohmAST2RawZeusDef(ast: any): RawTscaDef {
    const rawdef: RawTscaDef = {
        types: {},
        usecases: {},
        schemas: {}
    };

    ast.forEach(item => {
        switch(item.type){
            case "ServiceDef":
                const svcName = item["1"]
                rawdef.usecases[svcName] = ohmServiceDef2RawZeusUsecase(item);
            case "StructDef":
            case "OptionDef":
        }
    });

    return rawdef;
}

function ohmServiceDef2RawZeusUsecase(ast: any): RawTscaUsecase {
    const rawu: RawTscaUsecase = {};
    if(ast.type != "ServiceDef"){
        throw new Error(`got ${ast.type}, expect is ServiceDef`)
    }
    return rawu;
}