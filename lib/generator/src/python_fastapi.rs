use anyhow::bail;
use convert_case::{Case, Casing};
use cronus_spec::{
    PythonFastApiGeneratorOption, RawSchema, RawUsecaseMethod, RawUsecaseMethodRestOption,
};
use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use crate::{
    utils::{
        self, get_path_from_optional_parent, get_request_name, get_response_name,
        get_schema_by_name, get_usecase_name, spec_ty_to_py_builtin_ty, spec_ty_to_rust_builtin_ty,
    },
    Ctxt, Generator,
};
use anyhow::{Ok, Result};
use tracing::{self, debug, span, Level};

pub struct PythonFastApiGenerator {
    generated_tys: RefCell<HashSet<String>>,
}

impl PythonFastApiGenerator {
    pub fn new() -> Self {
        Self {
            generated_tys: Default::default(),
        }
    }
}

impl Generator for PythonFastApiGenerator {
    fn name(&self) -> &'static str {
        "python_fastapi"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        let gen_opt = self.get_gen_option(ctx);

        let get_ctx_from = match gen_opt {
            Some(gen_opt) => match &gen_opt.get_ctx_from {
                Some(import_from) => import_from,
                None => bail!("python_fastapi get_ctx_from option is not set")
            },
            None => {
                bail!("python_fastapi get_ctx_from option is not set");
            },
        };
        let get_ctx_import = &format!("from {get_ctx_from} import get_ctx");
        let common_imports = vec![
            get_ctx_import,
            "from pydantic import BaseModel",
            "from fastapi import APIRouter, Depends, Request, status",
            "from typing import Optional",
        ];
        let common_imports_str = common_imports.join("\n") + "\n";
        ctx.append_file(self.name(), &self.dst(ctx), &common_imports_str);
        Ok(())
    }

    fn generate_schema(&self, ctx: &Ctxt, schema_name: &str, schema: &RawSchema) -> Result<()> {
        self.generate_struct(ctx, schema, Some(schema_name.to_owned()), None);
        Ok(())
    }

    /// Generate the Python trait for the usecase
    /// @router.get('/')
    /// def xxx():
    ///   ctx.usecase.xxx()
    ///
    ///
    fn generate_usecase(
        &self,
        ctx: &Ctxt,
        name: &str,
        usecase: &cronus_spec::RawUsecase,
    ) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();
        let trait_name = name.to_case(Case::Snake);
        let mut py_imports: Vec<String> = vec![];
        // TODO: customized error type
        let mut result = String::new();

        let router_var = format!("{}_router", trait_name);
        let mut router_args:Vec<String> = vec![];

        match &usecase.option {
            Some(usecase_opt) => {
                match &usecase_opt.rest {
                    Some(rest) => {
                        if let Some(path) = &rest.path {
                            if !path.starts_with("/") {
                                router_args.push(format!("prefix='/{}'", path));
                            } else {
                                router_args.push(format!("prefix='{}'", path));

                            }

                        }
                    }
                    None => bail!("python_fastapi router_arg option is not set"),
                }
            }
            None => {
            }
        };

        let router_args_str = if router_args.len() != 0 {
            router_args.join(", ")
        } else {
            "".to_string()
        };
        
        result += &format!("{} = APIRouter({})\n", router_var, router_args_str);

        for (method_name, method) in &usecase.methods {
            let rest = match method.option {
                Some(ref option) => {
                    if let Some(rest) = &option.rest {
                        rest
                    } else {
                        continue;
                    }
                }
                None => continue,
            };
            // handle async fn
            let mut has_async = false;
            match self.get_gen_option(ctx) {
                Some(gen_opt) => match gen_opt.async_flag {
                    Some(flag) => {
                        if flag {
                            has_async = true;
                        }
                    }
                    _ => {}
                },
                _ => {}
            }

            let rest_path = match &rest.path {
                Some(path) => path,
                None => &"".to_string(),
            };

            let path_params = utils::get_path_params(method);

            // tranlate path to fastapi path
            let mut translated_path = turn_cronus_path_to_fastapi_path(&rest_path, Case::Snake);
            if !translated_path.is_empty() && !translated_path.starts_with("/") {
                translated_path = format!("/{translated_path}");
            }
            result += &format!("@{}.{}('{}')\n", router_var, rest.method, translated_path);
            if has_async {
                result += "async ";
            }
            result += &format!("def ");
            result += &method_name.to_case(Case::Snake);
            result += "(";
            
            let mut arg_strs: Vec<String> = vec![];

            // prepare body if http method is not get

            if let Some(req) = &method.req {
                let request_ty = get_request_name(ctx, method_name);
                py_imports.push(request_ty.clone());

                if rest.method != "get" {
                    let mut cloned_req = req.clone();

                    // remove path parameters from request struct

                    if let Some(path_params) = path_params.as_ref() {
                        for param in path_params {
                            cloned_req.properties.as_mut().unwrap().remove(param);
                        }
                    }

                    let body_ty = format!("{}Body", method_name.to_case(Case::UpperCamel));
                    if cloned_req.properties.as_ref().unwrap().len() != 0 {
                        self.generate_struct(ctx, &cloned_req, Some(body_ty.clone()), None);
                        arg_strs.push(format!("body: {}", body_ty));
                    }
                } else {
                    req.properties.as_ref().unwrap().into_iter().for_each(|(prop_name, prop_schema)| {
                        if let Some(path_params) = path_params.as_ref() {
                            if path_params.contains(prop_name) {
                                return;
                            }
                        }

                        let ty = self.generate_struct(ctx, prop_schema, None, None);
                        arg_strs.push(format!("{}: {}", prop_name.to_case(Case::Snake), ty));
                    });
                }
            }

            // handle path parameters
            match get_method_path_names_and_tys(method)? {
                Some((props, tys)) => {
                    for (i, prop) in props.iter().enumerate() {
                        arg_strs.push(format!("{}: {}", prop.to_case(Case::Snake), tys[i]));
                    }
                }
                None => {}
            }

            // get ctx depends
            arg_strs.push("ctx = Depends(get_ctx)".to_string());
            let arg_str = arg_strs.join(", ");
            if !arg_str.is_empty() {
                result += &arg_str;
            }
            result += ")";

            let mut result_type: String = "None".to_string();

            let mut has_res = false;
            // generate response
            if let Some(res) = &method.res {
                has_res = true;
                let response_ty = get_response_name(ctx, method_name);
                self.generate_struct(ctx, &res, Some(response_ty.clone()), None);
                result_type = response_ty;
                result += &format!(" -> {}", result_type);
            }

            result += ":\n";

            let mut has_request = false;
            // request object creation
            if let Some(req) = &method.req {
                has_request = true;
                result += "  request = ";
                result += &get_request_name(ctx, method_name);
                result += "(";
                let mut first = true;
                for (prop_name, prop_schema) in req.properties.as_ref().unwrap() {
                    if first {
                        first = false;
                    } else {
                        result += ", ";
                    }
                    result += &prop_name.to_case(Case::Snake);
                    result += "=";

                    // if property is in body, use body.xxx
                    // otherwise, use xxx directly
                    let mut in_path = false;
                    if let Some(path_params) = path_params.as_ref() {
                        if path_params.contains(prop_name)  {
                            result += &prop_name.to_case(Case::Snake);
                            in_path = true;
                        }
                    }

                    if !in_path {
                        if rest.method == "get" {
                            result += &prop_name.to_case(Case::Snake);
                        }
                        else {
                            result += "body.";
                            result += &prop_name.to_case(Case::Snake);
                        }
                    }


                }
                result += ")\n";
            }

            if has_res {
                result += "  return"
            }

            // assign request body
            if has_async {
                if has_res {
                    result += " await ";
                } else {
                    result += "  await ";

                }
            }
            let call_usecase = format!("ctx.{}.{}({})", trait_name, method_name.to_case(Case::Snake), if has_request {
                "request"
            } else {
                ""
            });
            result += &call_usecase;
            result += "\n";
        }

        // handle imports first
        if py_imports.len() != 0 {
            let gen_opt = self.get_gen_option(ctx);

            let usecase_from: &str = match gen_opt {
                Some(gen_opt) => match &gen_opt.usecase_from {
                    Some(usecase_from) => usecase_from.as_ref(),
                    None => bail!("python_fastapi usecase_from option is not set")
                },
                None => {
                    bail!("python_fastapi usecase_from option is not set");
                },
            };
            let imports_str = format!("from {} import {}\n", usecase_from, py_imports.join(", "));
            ctx.append_file(self.name(), &self.dst(ctx), &imports_str);
        }

        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }
}

fn turn_cronus_path_to_fastapi_path(path: &str, var_case: Case) -> String {
    // turn /:id to /{id}
    let mut result = String::new();
    let mut in_param = false;
    let mut param: String = String::new();
    for c in path.chars() {
        if in_param && c != '/' {
            param.push(c);
        } 
        if c == ':' {
            in_param = true;
            result.push('{');
        } else if c == '/' {
            if in_param {
                result += &param.to_case(var_case);
                result.push('}');
                in_param = false;
                param.clear();
            }
            result.push(c);
        } else {
            if !in_param {
                result.push(c);
            }
        }
    }
    if in_param {
        result += &param.to_case(var_case);
        result.push('}');
    }
    result
}

fn get_method_path_names_and_tys(
    method: &RawUsecaseMethod,
) -> Result<Option<(Vec<String>, Vec<String>)>> {
    let path_params = utils::get_path_params(method);
    let mut struct_fields: Vec<String> = Vec::new();
    let mut struct_tys: Vec<String> = Vec::new();
    match path_params {
        Some(path_params) => {
            for prop in &path_params {
                let prop_schema = method
                    .req
                    .as_ref()
                    .unwrap()
                    .properties
                    .as_ref()
                    .unwrap()
                    .get(prop)
                    .unwrap();

                let ty: String;

                if prop_schema.items.is_some() {
                    bail!("array property cannot be used as path variable")
                }

                if let Some(t) = utils::spec_ty_to_py_builtin_ty(prop_schema.ty.as_ref().unwrap()) {
                    ty = t;
                } else {
                    ty = prop_schema.ty.as_ref().unwrap().clone();
                }

                struct_fields.push(prop.clone());
                struct_tys.push(ty);
            }

            Ok(Some((struct_fields, struct_tys)))
        }
        None => Ok(None),
    }
}

impl PythonFastApiGenerator {
    /// Generate the Python struct definition
    ///
    fn generate_struct(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
        root_schema_ty: Option<String>,
    ) -> String {
        let type_name: String;

        // find out the correct type name
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        } else if schema.items.is_some() {
            type_name = self.generate_struct(
                ctx,
                schema.items.as_ref().unwrap(),
                None,
                root_schema_ty.clone(),
            );

            return format!("list[{}]", type_name).to_owned();
        } else {
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
            if let Some(root_schema_ty) = root_schema_ty {
                if root_schema_ty == type_name {
                    return type_name;
                }
            }
            return type_name;
        }

        // if it is referenced to a custom type, find and return
        if let Some(ref_schema) = get_schema_by_name(&ctx, &type_name) {
            // check whether schema is a type referencing another user type
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none()
            {
                return self.generate_struct(
                    ctx,
                    ref_schema,
                    Some(type_name.to_string()),
                    Some(type_name.to_string()),
                );
            }
        }

        self.generated_tys.borrow_mut().insert(type_name.clone());

        let mut result = format!("class {}(BaseModel):\n", type_name).to_string();

        if let Some(properties) = &schema.properties {
            for (prop_name, prop_schema) in properties {
                let snaked_prop_name = prop_name.to_case(Case::Snake);
                result += "  ";
                result += &snaked_prop_name;
                result += ": ";

                let optional = match prop_schema.required {
                    Some(req) => !req,
                    None => false,
                };

                let prop_ty =
                    self.generate_struct(ctx, &prop_schema, None, Some(type_name.clone()));

                if optional {
                    result += &format!("Optional[{}]", prop_ty);
                } else {
                    result += &prop_ty;
                }
                result += "\n";
            }
        }

        ctx.append_file(self.name(), &self.dst(ctx), &result);

        type_name
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a PythonFastApiGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| {
            go.generator
                .as_ref()
                .and_then(|gen| gen.python_fastapi.as_ref())
        })
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "generated.py";

        match &ctx.spec.option {
            Some(go) => match &go.generator {
                Some(gen) => match &gen.python_fastapi {
                    Some(gen) => {
                        let dest_path = get_path_from_optional_parent(
                            gen.def_loc.file.parent(),
                            gen.file.as_ref(),
                            default_file,
                        );
                        return dest_path;
                    }
                    None => default_file.into(),
                },
                None => default_file.into(),
            },
            None => default_file.into(),
        }
    }
}

#[cfg(test)]
mod test {
    use std::path::PathBuf;

    use cronus_parser::api_parse;

    use super::PythonFastApiGenerator;
    use crate::{run_generator, Ctxt, Generator};
    use anyhow::{Ok, Result};

    #[test]
    fn py_struct() -> Result<()> {
        let api_file: &'static str = r#"
        struct hello {
            a: string
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = PythonFastApiGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("python");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("generated.py").unwrap();

        assert!(file_content.find("a: str").is_some());

        Ok(())
    }

    #[test]
    fn py_async_def() -> Result<()> {
        let api_file: &'static str = r#"
        #[@python.async]
        usecase User {
            createUser {}
        }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        let ctx = Ctxt::new(spec);
        let g = PythonFastApiGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs("python");
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("generated.py").unwrap();
        println!("{}", file_content);
        assert!(file_content.find("async def create_user").is_some());

        Ok(())
    }
}
