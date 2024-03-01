use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use convert_case::{Case, Casing};
use cronus_spec::{RawSchema, RustGeneratorOption};

use crate::{
    utils::{self, get_path_from_optional_parent, get_request_name, get_response_name, get_schema_by_name, get_usecase_name, spec_ty_to_rust_builtin_ty}, Ctxt, Generator
};
use tracing::{self, debug, span, Level};
use anyhow::{Ok, Result};

pub struct RustGenerator {
    generated_tys: RefCell<HashSet<String>>
}


impl RustGenerator {
    pub fn new() -> Self {
        Self {
            generated_tys: Default::default()
        }
    }
}

impl Generator for RustGenerator {
    fn name(&self) -> &'static str {
        "rust"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        
        let common_uses = vec!["use serde::{Deserialize, Serialize};","use async_trait::async_trait;"];
        let common_uses_str = common_uses.join("\n") + "\n";
        ctx.append_file(self.name(), &self.dst(ctx), &common_uses_str);

        // custom uses
        match self.get_gen_option(ctx) {
            Some(rust_gen) => {
                match &rust_gen.uses {
                    Some(uses) => {
                        let use_stmts:Vec<String> = uses.iter().map(|u| format!("use {};", u).to_string()).collect();
                        
                        let str = use_stmts.join("\n") + "\n";
                        ctx.append_file(self.name(), &self.dst(ctx), &str);

                    },
                    None => {},
                }
            },
            None => {},
        }

        Ok(())

    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name:&str, schema: &RawSchema) -> Result<()> {
        self.generate_struct(ctx, schema, Some(schema_name.to_owned()));
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
        // TODO: customized error type
        let default_error_ty: &str = "Box<dyn std::error::Error>";
        let mut result = String::new();

        // handle async trait
        match self.get_gen_option(ctx) {
            Some(rust_gen) => {
                match rust_gen.async_trait {
                    Some(flag) => {
                        if flag {
                            result += "#[async_trait]\n";
                        }
                    },
                    _ => {}
                }
            },
            _ => {}
        }
        result += &format!("pub trait {} {{\n", trait_name);
        for (method_name, method) in &usecase.methods {

            // handle async fn 
            match self.get_gen_option(ctx) {
                Some(rust_gen) => {
                    match rust_gen.async_flag {
                        Some(flag) => {
                            if flag {
                                result += "  async";
                            }
                        },
                        _ => {}
                    }
                },
                _ => {}
            }
            result += "  fn ";
            result += &method_name.to_case(Case::Snake);
            result += "(&self";

            if let Some(req) = &method.req {
                let request_ty = get_request_name(ctx, method_name);
                self.generate_struct(ctx, &req, Some(request_ty.clone()));
                result += ", request: ";
                result += &request_ty;
            }
            result += ")";

            let mut result_t_type: String = "()".to_string();
            let mut result_f_type: Option<String> = Some(default_error_ty.to_string());
            
            if let Some(res) = &method.res {
                let response_ty = get_response_name(ctx, method_name);
                self.generate_struct(ctx, &res, Some(response_ty.clone()));
                result_t_type = response_ty;
            } 

            // handle result false type
            match self.get_gen_option(ctx) {
                Some(rust_gen) => {
                    if let Some(no_error_type) = rust_gen.no_error_type {
                        if no_error_type {
                            result_f_type = None
                        } 
                    }
                    else if let Some(error_type) = &rust_gen.error_type {
                        result_f_type = Some(error_type.clone())
                    }
                    
                },
                _ => {}
            }

            if result_f_type.is_some() {
                result += &format!(" -> Result<{}, {}>", result_t_type, result_f_type.unwrap());
            } else {
                result += &format!(" -> Result<{}>", result_t_type);
            }

            result += ";\n";
        }
        result += "}\n";

        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }

   

  
    
}

impl RustGenerator {
    


 
    /// Generate the Rust struct definition
    ///
    fn generate_struct(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
    ) -> String {
        let type_name: String;
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        } 
        else if schema.items.is_some() {
            type_name = self.generate_struct(ctx, schema.items.as_ref().unwrap(), None);
            return format!("Vec<{}>", type_name).to_owned()
        }
        else {
            type_name = schema.ty.as_ref().unwrap().clone();
        }
       

        let span = span!(Level::TRACE, "generate_struct", "type" = type_name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        // if type name belongs to built-in type, return directly
        if let Some(ty) = spec_ty_to_rust_builtin_ty(&type_name) {
            return ty;
        }

        if self.generated_tys.borrow().contains(&type_name) {
            return type_name;
        }

        // if it is referenced to a custom type, find and return 
        if let Some(ref_schema) = get_schema_by_name(&ctx, &type_name) {
            // check whether schema is a type referencing another user type
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none() {
                return self.generate_struct(ctx, ref_schema, Some(type_name.to_string()));
            }
        }
        let mut attrs: Vec<String> = vec![];

        if let Some(gen_opt) = self.get_gen_option(ctx) {
            let default_derive = match &gen_opt.default_derive {
                Some(default_derive) => default_derive.clone(),
                None => vec!["Debug", "Clone", "Serialize", "Deserialize", "PartialEq", "Eq"].iter().map(|s|s.to_string()).collect(),
            };

            let no_default_derive = match gen_opt.no_default_derive {
                Some(no_default) => {
                    no_default
                },
                None => { false }, // default value is false
            };

            if !no_default_derive {
                let derive_attr = format!("#[derive({})]", default_derive.join(", "));
                attrs.push(derive_attr);
        
            }
        } 



        match &schema.option {
            Some(option) => {
                match &option.rust {
                    Some(rust_opt) => {

                        match &rust_opt.attrs {
                            Some(custom_attrs) => {
                                attrs.extend(custom_attrs.iter().map(|attr| format!("#[{}]", attr).to_string()) );
                            },
                            None => {},
                        }
                    },
                    None => {}
                }
            },
            None => {},
        }

        let mut result = format!("{}\npub struct {} {{\n", attrs.join("\n"), type_name).to_string();


        if let Some(properties) = &schema.properties {
            for (prop_name, prop_schema) in properties {

                let mut attrs: Vec<String> = vec![];
                match &prop_schema.option {
                    Some(option) => {
                        match &option.rust {
                            Some(rust_opt) => {
                                match &rust_opt.attrs {
                                    Some(custom_attrs) => {
                                        attrs.extend(custom_attrs.iter().map(|attr| format!("#[{}]", attr).to_string()) );
                                    },
                                    None => {},
                                }
                            },
                            None => {}
                        }
                    },
                    None => {},
                }

                if !attrs.is_empty() {
                    result += &format!("  {}\n", attrs.join("\n"));
                }

                result += "  pub ";
                result += prop_name;
                result += ": ";

                let optional = match prop_schema.required {
                    Some(req) => !req,
                    None => false
                };

                let prop_ty = self.generate_struct(ctx, &prop_schema, None);
                if optional {
                    result += &format!("Option<{}>", prop_ty);

                } else {
                    result += &prop_ty;
                }
                result += ",\n";
            }
        }

        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);

        self.generated_tys.borrow_mut().insert(type_name.clone());

        type_name
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a RustGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| go.generator.as_ref().and_then(|gen| gen.rust.as_ref()))
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "types.rs";

        match &ctx.spec.option {
            Some(go) => {
                match &go.generator {
                    Some(gen) => {
                        match &gen.rust {
                            Some(rust_gen) => {
                                get_path_from_optional_parent(rust_gen.def_loc.file.parent(), rust_gen.file.as_ref(), default_file)
                            },
                            None => default_file.into(),
                        }
                    },
                    None => {
                        default_file.into()
                    },
                }
            },
            None => {
                default_file.into()
            },
        }

    }
}


#[cfg(test)]
mod test {
    use std::path::PathBuf;

    use cronus_parser::api_parse;

    use crate::{run_generator, Ctxt, Generator};
    use anyhow::{Ok, Result};
    use super::RustGenerator;

    #[test]
    fn custom_struct() -> Result<()>{
        let api_file: &'static str = r#"
        struct hello {
            a: string
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = RustGenerator::new();
        run_generator(&g, &ctx);
        let gfs = ctx.get_gfs("rust");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("types.rs").unwrap();

        assert!(file_content.find("a: String").is_some());

        Ok(())
    }

    #[test]
    fn ref_custom_struct() -> Result<()>{
        let api_file: &'static str = r#"
        struct Hello {
            a: Hello1
        }

        struct Hello1 {
            b: string
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;

        let ctx = Ctxt::new(spec);
        let g = RustGenerator::new();
        run_generator(&g, &ctx);
        let gfs = ctx.get_gfs("rust");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("types.rs").unwrap();
        println!("{:?} -- {}", ctx.spec, file_content);

        assert!(file_content.find("a: Hello1").is_some());
        assert!(file_content.find("b: String").is_some());

        Ok(())
    }

    #[test]
    fn array_ty() -> Result<()>{
        let api_file: &'static str = r#"
        struct hello {
            a: string[]
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = RustGenerator::new();
        run_generator(&g, &ctx);
        let gfs = ctx.get_gfs("rust");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("types.rs").unwrap();
        println!("{}", file_content);

        assert!(file_content.find("a: Vec<String>").is_some());

        Ok(())
    }

    #[test]
    fn custom_uses() -> Result<()>{
        let api_file: &'static str = r#"
        global [generator.rust.uses = ("anyhow::Result")]

        usecase abc {
            create_abcd {
                in {
                    a: string
                }
                out {
                    b: string
                }
            }
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = RustGenerator::new();
        run_generator(&g, &ctx);
        let gfs = ctx.get_gfs("rust");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("types.rs").unwrap();
        println!("{}", file_content);
        assert!(file_content.find("use anyhow::Result;").is_some());
        assert!(file_content.find("struct CreateAbcdRequest").is_some());
        assert!(file_content.find("a: String").is_some());
        Ok(())
        
    }
}