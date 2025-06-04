use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use convert_case::{Case, Casing};
use cronus_spec::{RawSchema, GolangGeneratorOption};

use crate::{
    utils::{self, get_path_from_optional_parent, get_request_name, get_response_name, get_schema_by_name, get_usecase_name, spec_ty_to_golang_builtin_ty, spec_ty_to_rust_builtin_ty}, Ctxt, Generator
};
use tracing::{self, debug, span, Level};
use anyhow::{Ok, Result};

pub struct GolangGenerator {
    generated_tys: RefCell<HashSet<String>>
}


impl GolangGenerator {
    pub fn new() -> Self {
        Self {
            generated_tys: RefCell::new(HashSet::new())
        }
    }
}

impl Generator for GolangGenerator {
    fn name(&self) -> &'static str {
        "golang"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        
        let mut imports = vec![
            "context"
        ];


        let pkg = self.get_gen_option(ctx)
        .and_then(|gen_opt| gen_opt.package.clone())
        .unwrap_or_else(|| "domain".to_string());
        ctx.append_file(self.name(), &self.dst(ctx), 
                &format!("package {}\n\n", pkg));

        let import_str = imports.iter().map(|imp| format!("\"{}\"", imp)).collect::<Vec<String>>().join("\n");
        ctx.append_file(self.name(), &self.dst(ctx), 
                &format!("import (\n{}\n)\n\n", import_str));

        Ok(())

    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name:&str, schema: &RawSchema) -> Result<()> {
        self.generate_struct(ctx, schema, Some(schema_name.to_owned()), None);
        Ok(())
    }


    /// Generate the Rust trait for the usecase
    ///
    /// trait <name><usecase prefix> {
    ///   fn <method name>(&self, request) -> response;
    /// }
    ///
    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &cronus_spec::RawUsecase) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();
        let trait_name = get_usecase_name(ctx, name);

        let mut result = String::new();

       
        result += &format!("type {} interface {{\n", trait_name);
        for (method_name, method) in &usecase.methods {

            result += "  ";
            result += &method_name.to_case(Case::UpperCamel);
            let mut method_params: Vec<String> = vec![];
            method_params.push("ctx context.Context".to_string());

            if let Some(req) = &method.req {
                let request_ty = get_request_name(ctx, method_name);
                self.generate_struct(ctx, &req, Some(request_ty.clone()), None)?;
                method_params.push(format!("request *{}", request_ty));
            }
            let params_str = method_params.join(", ");
            result += &format!("({})", params_str);

            
            if let Some(res) = &method.res {
                let response_ty = get_response_name(ctx, method_name);
                self.generate_struct(ctx, &res, Some(response_ty.clone()), None)?;
                result += format!("(*{}, error)", response_ty).as_str();
            } else {
                result += "error";
            }

            

            

            result += "\n";
        }
        result += "}\n";

        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }

   

  
    
}

impl GolangGenerator {
    


 
    /// Generate the Rust struct definition
    ///
    fn generate_struct(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
        root_schema_ty: Option<String>
    ) -> Result<String> {
        let type_name: String;

        // find out the correct type name
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        }
        else if schema.items.is_some() {

            type_name = self.generate_struct(ctx, schema.items.as_ref().unwrap(), None, root_schema_ty.clone())?;

            return Ok(format!("[]*{}", type_name).to_owned());
        }
        else {
            type_name = schema.ty.as_ref().unwrap().clone();
        }




        let span = span!(Level::TRACE, "generate_struct", "type" = type_name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        // if type name belongs to built-in type, return directly
        if let Some(ty) = spec_ty_to_golang_builtin_ty(&type_name) {
            return Ok(ty);
        }

        if self.generated_tys.borrow().contains(&type_name) {
            if let Some(root_schema_ty) = root_schema_ty  {
                if  root_schema_ty == type_name {
                    return Ok(format!("{type_name}"))
                }
            }
            return Ok(type_name);
        }



        // if it is referenced to a custom type, find and return 
        if let Some(ref_schema) = get_schema_by_name(&ctx, &type_name) {
            // check whether schema is a type referencing another user type
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none() {
                return self.generate_struct(ctx, ref_schema, Some(type_name.to_string()), Some(type_name.to_string()));
            }
        }

        self.generated_tys.borrow_mut().insert(type_name.clone());

        // if it is a enum type, generate the enum definition
        if let Some(enum_items) = &schema.enum_items {
            let enum_int = enum_items.iter().any(|item| item.value.is_some());
            let enum_actual_ty = if enum_int {
                "int"
            } else {
                "string"
            };
            let mut enum_def = format!("type {} {}\n", type_name, enum_actual_ty);
            for item in enum_items {
                let enum_value = if enum_int {
                    if item.value.is_none() {
                        return Err(anyhow::anyhow!("Enum item {} has no value when other enum has set", item.name));
                    }
                    format!("{}", item.value.unwrap())
                } else {
                    format!("\"{}\"", item.name.to_uppercase())
                };
                enum_def += &format!("const {} {} = {}\n", item.name.to_case(Case::UpperSnake), type_name, enum_value);
            }
            ctx.append_file(self.name(), &self.dst(ctx), &enum_def);
            return Ok(type_name);
        }



        let mut result = format!("type {} struct {{\n", type_name).to_string();


        if let Some(properties) = &schema.properties {
            for (prop_name, prop_schema) in properties {

                // let mut attrs: Vec<String> = vec![];
                // match &prop_schema.option {
                //     Some(option) => {
                //         match &option.rust {
                //             Some(rust_opt) => {
                //                 match &rust_opt.attrs {
                //                     Some(custom_attrs) => {
                //                         attrs.extend(custom_attrs.iter().map(|attr| format!("#[{}]", attr).to_string()) );
                //                     },
                //                     None => {},
                //                 }
                //             },
                //             None => {}
                //         }
                //     },
                //     None => {},
                // }

                // if !attrs.is_empty() {
                //     result += &format!("  {}\n", attrs.join("\n"));
                // }

                result += "  ";
                result += prop_name.to_case(Case::UpperCamel).as_str();
                result += " ";

                let optional = match prop_schema.required {
                    Some(req) => !req,
                    None => false
                };

                let prop_ty = self.generate_struct(ctx, &prop_schema, None, Some(type_name.clone()))?;

                if optional {
                    result += &format!("*{}", prop_ty);

                } else {
                    result += &prop_ty;
                }
                result += "\n";
            }
        }

        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);



        Ok(type_name)
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a GolangGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| go.generator.as_ref().and_then(|gen| gen.golang.as_ref()))
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "domain.golang";

        if let Some(go_opt) = self.get_gen_option(ctx) {
            let dest_path = get_path_from_optional_parent(go_opt.def_loc.file.parent(), go_opt.file.as_ref(), default_file);
                return dest_path;
        }
        default_file.into()

    }
}