use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use convert_case::{Case, Casing};
use cronus_spec::{RawSchema, PythonGeneratorOption};

use crate::{
    utils::{self, get_path_from_optional_parent, get_request_name, get_response_name, get_schema_by_name, get_usecase_name, spec_ty_to_py_builtin_ty, spec_ty_to_rust_builtin_ty}, Ctxt, Generator
};
use tracing::{self, debug, span, Level};
use anyhow::{Ok, Result};

pub struct PythonGenerator {
    generated_tys: RefCell<HashSet<String>>
}


impl PythonGenerator {
    pub fn new() -> Self {
        Self {
            generated_tys: Default::default()
        }
    }
}

impl Generator for PythonGenerator {
    fn name(&self) -> &'static str {
        "python"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        
        let common_imports = vec!["from abc import ABC, abstractmethod", "from dataclasses import dataclass", "from typing import Optional"];
        let common_imports_str = common_imports.join("\n") + "\n";
        ctx.append_file(self.name(), &self.dst(ctx), &common_imports_str);

        // custom uses
        match self.get_gen_option(ctx) {
            Some(rust_gen) => {
                // match &rust_gen.uses {
                //     Some(uses) => {
                //         let use_stmts:Vec<String> = uses.iter().map(|u| format!("use {};", u).to_string()).collect();

                //         let str = use_stmts.join("\n") + "\n";
                //         ctx.append_file(self.name(), &self.dst(ctx), &str);

                //     },
                //     None => {},
                // }
            },
            None => {},
        }

        Ok(())

    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name:&str, schema: &RawSchema) -> Result<()> {
        self.generate_struct(ctx, schema, Some(schema_name.to_owned()), None);
        Ok(())
    }


    /// Generate the Python trait for the usecase
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
                // match rust_gen.async_trait {
                //     Some(flag) => {
                //         if flag {
                //             result += "#[async_trait]\n";
                //         }
                //     },
                //     _ => {}
                // }
            },
            _ => {}
        }
        result += &format!("class {}(ABC):\n", trait_name);
        for (method_name, method) in &usecase.methods {
            result += "  @abstractmethod\n";
            // handle async fn
            let mut has_async = false;
            match self.get_gen_option(ctx) {
                Some(gen_opt) => {
                    match gen_opt.async_flag {
                        Some(flag) => {
                            if flag {
                                result += "  async ";
                                has_async = true;
                            }
                        },
                        _ => {}
                    }
                },
                _ => {}
            }
            if !has_async {
                result += "  ";
            }
            result += "def ";
            result += &method_name.to_case(Case::Snake);
            result += "(self";

            if let Some(req) = &method.req {
                let request_ty = get_request_name(ctx, method_name);
                self.generate_struct(ctx, &req, Some(request_ty.clone()), None);
                result += ", request: ";
                result += &request_ty;
            }
            result += ")";

            let mut result_type: String = "None".to_string();

            if let Some(res) = &method.res {
                let response_ty = get_response_name(ctx, method_name);
                self.generate_struct(ctx, &res, Some(response_ty.clone()), None);
                result_type = response_ty;
            }

            result += &format!(" -> {}", result_type);
            result += ":\n";
            result += "    pass\n";
        }


        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }

   

  
    
}

impl PythonGenerator {
    


 
    /// Generate the Python struct definition
    ///
    fn generate_struct(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
        root_schema_ty: Option<String>
    ) -> String {
        let type_name: String;

        // find out the correct type name
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        }
        else if schema.items.is_some() {

            type_name = self.generate_struct(ctx, schema.items.as_ref().unwrap(), None, root_schema_ty.clone());

            return format!("list[{}]", type_name).to_owned()
        }
        else {
            type_name = schema.ty.as_ref().unwrap().clone();
        }

        println!("generating {type_name}[root={root_schema_ty:?}]");



        let span = span!(Level::TRACE, "generate_struct", "type" = type_name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        // if type name belongs to built-in type, return directly
        if let Some(ty) = spec_ty_to_py_builtin_ty(&type_name) {
            return ty;
        }

        if self.generated_tys.borrow().contains(&type_name) {
            if let Some(root_schema_ty) = root_schema_ty  {
                if  root_schema_ty == type_name {
                    return format!("'{type_name}'")
                }
            }
            return type_name;
        }



        // if it is referenced to a custom type, find and return 
        if let Some(ref_schema) = get_schema_by_name(&ctx, &type_name) {
            // check whether schema is a type referencing another user type
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none() {
                return self.generate_struct(ctx, ref_schema, Some(type_name.to_string()), Some(type_name.to_string()));
            }
        }


        self.generated_tys.borrow_mut().insert(type_name.clone());

        let mut result = format!("@dataclass\nclass {}:\n",  type_name).to_string();

        let mut required_fields =  Vec::new();
        let mut optional_fields =  Vec::new(); 
        if let Some(properties) = &schema.properties {
            for (prop_name, prop_schema) in properties {
                let snaked_prop_name = prop_name.to_case(Case::Snake);
                let mut field = String::new();
                field += "  ";
                field += &snaked_prop_name;
                field += ": ";

                let optional = match prop_schema.required {
                    Some(req) => !req,
                    None => false
                };

                let prop_ty = self.generate_struct(ctx, &prop_schema, None, Some(type_name.clone()));

                if optional {
                    field += &format!("Optional[{}] = None", prop_ty);

                } else {
                    field += &prop_ty;
                }
                field += "\n";

                if optional {
                    optional_fields.push(field);
                } else {
                    required_fields.push(field);
                }
            }
        }
        result += required_fields.join("").as_str();
        result += optional_fields.join("").as_str();


        ctx.append_file(self.name(), &self.dst(ctx), &result);



        type_name
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a PythonGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| go.generator.as_ref().and_then(|gen| gen.python.as_ref()))
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "generated.py";

        match &ctx.spec.option {
            Some(go) => {
                match &go.generator {
                    Some(gen) => {
                        match &gen.python {
                            Some(gen) => {
                                let dest_path = get_path_from_optional_parent(gen.def_loc.file.parent(), gen.file.as_ref(), default_file);
                                return dest_path;
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
    use super::PythonGenerator;

    #[test]
    fn py_struct() -> Result<()>{
        let api_file: &'static str = r#"
        struct hello {
            a: string
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = PythonGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("python");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("generated.py").unwrap();

        assert!(file_content.find("a: str").is_some());

        Ok(())
    }

    #[test]
    fn py_async_def() -> Result<()>{
        let api_file: &'static str = r#"
        #[@python.async]
        usecase User {
            createUser {}
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = PythonGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("python");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("generated.py").unwrap();
        println!("{}", file_content);
        assert!(file_content.find("async def create_user").is_some());

        Ok(())
    }


}