

use convert_case::{Casing, Case};
use cronus_spec::{RawUsecase, RawUsecaseMethod, RawUsecaseMethodRestOption, RawSchema};

use crate::{Generator, Ctxt};



pub struct TypescriptNestjsGenerator {
}

impl TypescriptNestjsGenerator {
    pub fn new() -> Self {
        Self {
           
        }
    }
}

impl Generator for TypescriptNestjsGenerator {
    fn name(&self) -> &'static str {
        return "typescript_nestjs"
    }

    fn generate(&self, ctx: &Ctxt) {
        ctx.spec
            .usecases
            .iter()
            .flat_map(|m| m.iter())
            .for_each(|(name, usecase)| self.generate_usecase(ctx, name, usecase))
    }
}

impl TypescriptNestjsGenerator {

    pub fn generate_usecase(&self, ctx: &Ctxt,  name: &str, usecase: &RawUsecase) {
        let mut nestjs_code = String::new();
    
        // Start of the controller class
        nestjs_code.push_str(&format!("@Controller('/{}')\n", name.to_lowercase()));
        nestjs_code.push_str(&format!("export class {}Controller {{\n", name.to_case(Case::UpperCamel)));
    
        for (usecase_name, usecase_method) in &usecase.methods {
            // Generate methods within the controller
            if let Some(options) = &usecase_method.option {
                if let Some(rest_option) = &options.rest {
                    nestjs_code.push_str(&self.generate_method(usecase_name, usecase_method, rest_option));
                }
            }
            
        }
    
        // End of the controller class
        nestjs_code.push_str("}\n\n");
    
        ctx.append_file(self.name(), &self.dst(ctx), &nestjs_code);
    }

    fn generate_method(&self, usecase_name: &str, method: &RawUsecaseMethod, rest_option: &RawUsecaseMethodRestOption) -> String {
        let mut method_code = String::new();
    
        // Generate NestJS method code
        method_code.push_str(&format!("    @{}('{}')\n", &rest_option.method.to_case(Case::UpperCamel), rest_option.path.clone().unwrap_or("".to_string())));
        method_code.push_str(&format!("    async {}() {{\n", usecase_name.to_case(Case::Camel)));
        method_code.push_str("        // Handler logic here\n");
        method_code.push_str("    }\n");
        method_code
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        if let Some(gen_config) = &ctx.spec.option.as_ref().unwrap().generator {
            if let Some(tsnestjs_gen_config) = &gen_config.typescript_nestjs {
                if let Some(file) = &tsnestjs_gen_config.file {
                    return file.clone()
                }
               
            }
        }

        return "controller.ts".to_string();
    }


    pub fn generate_dto(&self, schema: &RawSchema, dto_name: &str) -> String {
        let mut dto_code = format!("export class {} {{\n", dto_name);
    
        if let Some(ty) = &schema.ty {
            dto_code.push_str(&map_field("type", schema, false));
        }
    
        if let Some(items) = &schema.items {
            let nested_dto_name = format!("{}Item", dto_name);
            dto_code.push_str(&self.generate_dto(items, &nested_dto_name));
            dto_code.push_str(&format!("    items: {}[];\n", nested_dto_name));
        }
    
        if let Some(properties) = &schema.properties {
            for (key, prop_schema) in properties {
                let is_optional = prop_schema.required.unwrap_or(false);
                dto_code.push_str(&map_field(key, prop_schema, is_optional));
            }
        }
    
        if let Some(enum_items) = &schema.enum_items {
            // Handle enum items
        }
    
        // Handle other fields like extends, flat_extends, etc.
    
        dto_code.push_str("}\n\n");
        dto_code
    }
    

    
}

fn map_field(field_name: &str, schema: &RawSchema, is_optional: bool) -> String {
    let ts_type = match schema.ty.as_deref() {
        Some("string") => "string",
        Some("number") => "number",
        Some("boolean") => "boolean",
        Some("object") => "any", // Or map to a specific object type if possible
        Some("array") => "Array<any>", // Or map to a specific array type if possible
        _ => "any"
    };

    format!("    {}: {}{};\n", field_name, ts_type, if is_optional { "?" } else {""})
}