

use anyhow::{Ok, Result};
use convert_case::{Casing, Case};
use cronus_spec::{RawUsecase, RawSchema};
use tracing::{span, Level};

use crate::{Generator, Ctxt, utils::{get_request_name, get_usecase_name, get_response_name}};



pub struct TypescriptGenerator {
}

impl TypescriptGenerator {
    pub fn new() -> Self {
        Self {
           
        }
    }
}

impl Generator for TypescriptGenerator {
    fn name(&self) -> &'static str {
        return "typescript"
    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name:&str, schema: &RawSchema)-> Result<()> {
        self.generate_schema(ctx, Some(schema_name.to_owned()),  schema);
        Ok(())
    }

    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &RawUsecase) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();
        
        let usecase_name = get_usecase_name(ctx, name);
    
        let mut result = format!("export interface {} {{\n", usecase_name);
    
        for (method_name, method) in &usecase.methods {
            let method_name_camel = method_name.to_case(Case::Camel);

            let request_type = match &method.req {
                Some(req) => {
                    let request_type = get_request_name(ctx, &method_name_camel);
                    self.generate_schema(ctx, Some(request_type.clone()), req, );
                    request_type
                },
                None => String::new(),
            };
    
            let response_type = match &method.res {
                Some(res) => {
                    let response_type = get_response_name(ctx,  &method_name_camel);
                    self.generate_schema(ctx, Some(response_type.clone()), res, );
                    response_type
                },
                None => "Promise<void>".to_string(),
            };
    
            let method_signature = if request_type.is_empty() {
                format!("  {}(): {};\n", method_name_camel, response_type)
            } else {
                format!("  {}(request: {}): {};\n", method_name_camel, request_type, response_type)
            };

            result += &method_signature;
        }
    
        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }

    
}


impl TypescriptGenerator {


    fn dst(&self, ctx: &Ctxt) -> String {
        if let Some(gen_config) = &ctx.spec.option.as_ref().unwrap().generator {
            if let Some(ts_gen_config) = &gen_config.typescript {
                if let Some(file) = &ts_gen_config.file {
                    return file.clone()
                }
                
            }
        }

        return "types.ts".to_string();
    }

    pub fn generate_schema(&self,
        ctx: &Ctxt,
        override_name: Option<String>,
        schema: &RawSchema,
    ) {
        let interface_name: String;
        if let Some(ty) = override_name {
            interface_name = ty.to_case(Case::UpperCamel);
        } else {
            interface_name = schema.ty.as_ref().unwrap().clone();
        }

        let span = span!(Level::TRACE, "generate_inteface", "interface" = interface_name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        let ts_type = schema_to_ts_type(&schema);

        let result = format!("export interface {} {}\n", interface_name, ts_type);

        ctx.append_file(self.name(), &self.dst(ctx), &result);

    }
}


// Helper function to generate TypeScript type from RawSchema
fn schema_to_ts_type(schema: &RawSchema) -> String {
    if let Some(ref ty) = schema.ty {
        ty.clone()
    } else if let Some(ref items) = schema.items {
        format!("Array<{}>", schema_to_ts_type(items))
    } else if let Some(ref properties) = schema.properties {
        let mut props = String::new();
        for (key, value) in properties {
            props += &format!("  {}: {};\n", key, schema_to_ts_type(value));
        }
        format!("{{\n{}}}", props)
    } else {
        "any".to_string() // Fallback to 'any' type if no other information is available
    }
}