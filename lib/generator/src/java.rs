use std::{cell::RefCell, collections::HashSet, path::{Path, PathBuf}, vec};

use convert_case::{Case, Casing};
use cronus_spec::{RawSchema, JavaGeneratorOption};
use serde::de;

use crate::{
    utils::{get_path_from_optional_parent, get_request_name, get_response_name, get_schema_by_name, get_usecase_name, spec_ty_to_java_builtin_ty}, 
    Ctxt, Generator
};
use tracing::{debug, span, Level};
use anyhow::{Ok, Result};

pub struct JavaGenerator {
    generated_tys: RefCell<HashSet<String>>
}

impl JavaGenerator {
    pub fn new() -> Self {
        Self {
            generated_tys: Default::default()
        }
    }
}

impl Generator for JavaGenerator {
    fn name(&self) -> &'static str {
        "java"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        // TODO: make lombok configurable
        

        Ok(())
    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name: &str, schema: &RawSchema) -> Result<()> {
        self.generate_class(ctx, schema, Some(schema_name.to_owned()), None);
        Ok(())
    }

    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &cronus_spec::RawUsecase) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        let _enter = span.enter();
        
        let interface_name = get_usecase_name(ctx, name);
        let mut result = String::new();

        // Add package declaration if specified
        if let Some(package) = self.get_package(ctx) {
            let package_str = format!("package {};\n\n", package);
            result += &package_str;
        }
        

        // Custom imports
        if let Some(java_gen) = self.get_gen_option(ctx) {
            if let Some(imports) = &java_gen.imports {
                let import_stmts: Vec<String> = imports.iter()
                    .map(|i| format!("import {};", i))
                    .collect();
                let str = import_stmts.join("\n") + "\n\n";
                result += &str;
            }
        }

        result += &format!("public interface {} {{\n", interface_name);
        
        for (method_name, method) in &usecase.methods {
            result += "    ";
            
            let method_name_java = method_name.to_case(Case::Camel);
            
            let mut return_type = "void".to_string();
            if let Some(res) = &method.res {
                let response_ty = get_response_name(ctx, method_name);
                self.generate_class(ctx, res, Some(response_ty.clone()), None);
                return_type = response_ty;
            }

            result += &format!("{} {}", return_type, method_name_java);

            let mut method_params: Vec<String>  = Vec::new();

            // check generator options for extra parameters
            if let Some(java_gen) = self.get_gen_option(ctx) {
                if let Some(extra_params) = &java_gen.extra_method_parameters {
                    for param in extra_params {
                        method_params.push(param.to_string());
                    }
                }
            }


            if let Some(req) = &method.req {
                let request_ty = get_request_name(ctx, method_name);
                self.generate_class(ctx, req, Some(request_ty.clone()), None);
                method_params.push(format!("{} request", request_ty));
            }

            result += &format!("({})", method_params.join(", "));
            // Add throws clause if error handling is enabled
            if let Some(java_gen) = self.get_gen_option(ctx) {
                if let Some(exception_type) = &java_gen.exception_type {
                    result += &format!(" throws {}", exception_type);
                } else if !java_gen.no_exceptions.unwrap_or(false) {
                    result += " throws Exception";
                }
            } else {
                result += " throws Exception";
            }
            
            result += ";\n";
        }
        
        result += "}\n\n";
        let dst_dir = self.dst_dir(ctx);
        let dst_file = PathBuf::from(dst_dir).join(format!("{}.java", interface_name));
        ctx.append_file(self.name(), &dst_file.to_str().unwrap(), &result);

        Ok(())
    }
}

impl JavaGenerator {
    fn generate_class(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
        root_schema_ty: Option<String>
    ) -> String {
        let type_name: String;

        // Find out the correct type name
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        } else if schema.items.is_some() {
            let item_type = self.generate_class(ctx, schema.items.as_ref().unwrap(), None, root_schema_ty.clone());
            return format!("List<{}>", item_type);
        } else {
            type_name = schema.ty.as_ref().unwrap().clone();
        }

        let span = span!(Level::TRACE, "generate_class", "type" = type_name);
        let _enter = span.enter();

        // If type name belongs to built-in type, return directly
        if let Some(ty) = spec_ty_to_java_builtin_ty(&type_name) {
            return ty;
        }

        // If the type is excluded from generation, return itself
        if let Some(java_gen) = self.get_gen_option(ctx) {
            if java_gen.exclude_types.as_ref().map(|e| e.contains(&type_name)).unwrap_or(false) {
                return type_name;
            }
        }

        if self.generated_tys.borrow().contains(&type_name) {
            return type_name;
        }

        // If it is referenced to a custom type, find and return
        if let Some(ref_schema) = get_schema_by_name(ctx, &type_name) {
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none() {
                return self.generate_class(ctx, ref_schema, Some(type_name.to_string()), Some(type_name.to_string()));
            }
        }

        self.generated_tys.borrow_mut().insert(type_name.clone());

        let mut result = String::new();

        let common_imports = vec![
            "import java.util.List;",
            "import java.util.Map;",
            "import java.util.HashMap;",
            "import lombok.Data;",
            "import lombok.NoArgsConstructor;",
            "import lombok.AllArgsConstructor;",
            "import lombok.Builder;",
        ];
        let common_imports_str = common_imports.join("\n") + "\n\n";
        
        // Add package declaration if specified
        if let Some(package) = self.get_package(ctx) {
            let package_str = format!("package {};\n\n", package);
            result += &package_str;
        }
        
        result += &common_imports_str;

        // Custom imports
        if let Some(java_gen) = self.get_gen_option(ctx) {
            if let Some(imports) = &java_gen.imports {
                let import_stmts: Vec<String> = imports.iter()
                    .map(|i| format!("import {};", i))
                    .collect();
                let str = import_stmts.join("\n") + "\n\n";
                result += &str;
            }
        }
        
        
        
        // Handle enum
        if let Some(enum_items) = &schema.enum_items {
            result += &format!("public enum {} {{\n", type_name);
            for (i, item) in enum_items.iter().enumerate() {
                let enum_name = item.name.to_case(Case::ScreamingSnake);
                result += &format!("    {}", enum_name);
                if let Some(value) = item.value {
                    result += &format!("({})", value);
                }
                if i < enum_items.len() - 1 {
                    result += ",";
                }
                result += "\n";
            }
            
           
            
            result += "}\n\n";
        } else {
            // Regular class

            // Add class annotations
            let annotations = vec![
                "@Data",
                "@NoArgsConstructor",
                "@AllArgsConstructor",
                "@Builder",
            ];
            result += annotations.iter()
                .map(|a| format!("{}\n", a))
                .collect::<String>().as_str();

            result += &format!("public class {} {{\n", type_name);

            if let Some(properties) = &schema.properties {
                for (prop_name, prop_schema) in properties {
                    let java_prop_name = prop_name.to_case(Case::Camel);
                    

                    result += "    private ";

                  

                    let prop_ty = self.generate_class(ctx, prop_schema, None, Some(type_name.clone()));

                    result += &format!("{} {};\n", prop_ty, java_prop_name);
                }

                result += "\n";

            
            }

            result += "}\n\n";
        }
        let dest_dir = self.dst_dir(ctx);
        let dst_file = PathBuf::from(dest_dir).join(format!("{}.java", type_name));
        ctx.append_file(self.name(), &dst_file.to_str().unwrap(), &result);
        type_name
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a JavaGeneratorOption> {
        ctx.spec.option.as_ref()
            .and_then(|go| go.generator.as_ref())
            .and_then(|gen| gen.java.as_ref())
    }

    fn get_package(&self, ctx: &Ctxt) -> Option<String> {
        self.get_gen_option(ctx)
            .and_then(|java_gen| java_gen.package.clone())
    }

    fn dst_dir(&self, ctx: &Ctxt) -> String {
        let default_dir = ".";

        match &ctx.spec.option {
            Some(go) => {
                match &go.generator {
                    Some(gen) => {
                        match &gen.java {
                            Some(java_gen) => {
                                get_path_from_optional_parent(
                                    java_gen.def_loc.file.parent(),
                                    java_gen.dir.as_ref(),
                                    default_dir
                                )
                            },
                            None => default_dir.into(),
                        }
                    },
                    None => default_dir.into(),
                }
            },
            None => default_dir.into(),
        }
    }
}

#[cfg(test)]
mod test {
    use std::path::PathBuf;
    use cronus_parser::api_parse;
    use crate::{run_generator, Ctxt, Generator};
    use anyhow::{Ok, Result};
    use super::JavaGenerator;

    #[test]
    fn custom_class() -> Result<()> {
        let api_file: &'static str = r#"
        struct Hello {
            a: string
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = JavaGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("java");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("Types.java").unwrap();

        assert!(file_content.contains("public class Hello"));
        assert!(file_content.contains("String a;"));
        assert!(file_content.contains("public String getA()"));
        assert!(file_content.contains("public void setA(String a)"));

        Ok(())
    }

    #[test]
    fn array_type() -> Result<()> {
        let api_file: &'static str = r#"
        struct Hello {
            items: string[]
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = JavaGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("java");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("Types.java").unwrap();

        assert!(file_content.contains("List<String> items;"));

        Ok(())
    }
}