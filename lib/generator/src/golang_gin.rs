use anyhow::bail;
use convert_case::{Case, Casing};
use cronus_spec::{
    GolangGinGeneratorOption, PythonFastApiGeneratorOption, RawSchema, RawUsecaseMethod,
    RawUsecaseMethodRestOption,
};
use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use crate::{
    utils::{
        self, get_path_from_optional_parent, get_request_name, get_response_name,
        get_schema_by_name, get_usecase_name, spec_ty_to_golang_builtin_ty,
        spec_ty_to_py_builtin_ty, spec_ty_to_rust_builtin_ty,
    },
    Ctxt, Generator,
};
use anyhow::{Ok, Result};
use tracing::{self, debug, span, Level};

pub struct GolangGinGenerator {}

impl GolangGinGenerator {
    pub fn new() -> Self {
        Self {}
    }
}

impl Generator for GolangGinGenerator {
    fn name(&self) -> &'static str {
        "golang_gin"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        let gen_opt = self.get_gen_option(ctx);

        let pkg_name = gen_opt
            .and_then(|opt| opt.package.as_ref())
            .ok_or_else(|| anyhow::anyhow!("golang_gin domain_package option is not set"))?;

        ctx.append_file(
            self.name(),
            &self.dst(ctx),
            &format!("package {}\n\n", pkg_name),
        );

        let domain_import = gen_opt
            .and_then(|opt| opt.domain_import.as_ref())
            .ok_or_else(|| anyhow::anyhow!("golang_gin domain_import option is not set"))?;
        let imports = vec![domain_import, "net/http", "github.com/gin-gonic/gin"];
        let mut imports_str = imports
            .iter()
            .map(|import| format!("import \"{}\"", import))
            .collect::<Vec<String>>()
            .join("\n");
        imports_str += "\n\n";
        ctx.append_file(self.name(), &self.dst(ctx), &imports_str);

        Ok(())
    }

    /// Generate the Golang Gin router for the given usecase.
    fn generate_usecase(
        &self,
        ctx: &Ctxt,
        name: &str,
        usecase: &cronus_spec::RawUsecase,
    ) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        let has_rest_methods = usecase.methods.iter().any(|(_, method)| {
            method
                .option
                .as_ref()
                .and_then(|option| option.rest.as_ref())
                .is_some()
        });

        if !has_rest_methods {
            return Ok(());
        }

        let full_usecase_name = get_usecase_name(ctx, name);
        let domain_package = self
            .get_gen_option(ctx)
            .and_then(|gen_opt| gen_opt.domain_package.as_ref())
            .ok_or_else(|| anyhow::anyhow!("golang_gin domain_package option is not set"))?;

        let mut result = String::new();

        let path_prefix = usecase
            .option
            .as_ref()
            .and_then(|usecase_opt| usecase_opt.rest.as_ref())
            .and_then(|rest| rest.path.as_ref())
            .cloned()
            .unwrap_or_default();
        let service_var = "s";
        let setup_fn_name = format!(
            "func Setup{}Routes(r *gin.Engine, {} {}.{}) {{\n",
            full_usecase_name, service_var, domain_package, full_usecase_name
        );

        result += &setup_fn_name;
        let rg_var = "rg";
        result += &format!("  {} := r.Group(\"{}\")\n", rg_var, path_prefix);

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

            let rest_path = match &rest.path {
                Some(path) => path,
                None => &"".to_string(),
            };

            // register the route with the lambda function
            result += &format!(
                "  {}.{}(\"{}\", {})\n",
                rg_var,
                rest.method.to_ascii_uppercase(),
                rest_path,
                self.gen_usecase_method(ctx, service_var, domain_package, &method_name, method)?
            );

            //     // prepare body if http method is not get

            //     if let Some(req) = &method.req {
            //         let request_ty = get_request_name(ctx, method_name);

            //         if rest.method != "get" {
            //             let mut cloned_req = req.clone();

            //             // remove path parameters from request struct

            //             if let Some(path_params) = path_params.as_ref() {
            //                 for param in path_params {
            //                     cloned_req.properties.as_mut().unwrap().remove(param);
            //                 }
            //             }

            //             let mut need_generate_body = false;

            //             for (prop_name, prop_schema) in cloned_req.properties.as_ref().unwrap() {
            //                 if prop_schema.option.as_ref()
            //                     .and_then(|o| o.python_fastapi.as_ref().and_then(| opt| opt.exclude))
            //                     .unwrap_or(false) {
            //                     // skip properties if exclude is set
            //                     continue;
            //                 }
            //                 need_generate_body = true;
            //                 break
            //             }

            //             if need_generate_body {

            //                 let body_ty = format!("{}Body", method_name.to_case(Case::UpperCamel));
            //                 if cloned_req.properties.as_ref().unwrap().len() != 0 {
            //                     self.generate_struct(ctx, &cloned_req, Some(body_ty.clone()), None);
            //                     arg_strs.push(format!("body: {}", body_ty));

            //                 }
            //             }
            //         } else {
            //             req.properties.as_ref().unwrap().into_iter().for_each(|(prop_name, prop_schema)| {
            //                 if prop_schema.option.as_ref()
            //                 .and_then(|o| o.python_fastapi.as_ref().and_then(| opt| opt.exclude))
            //                 .unwrap_or(false) {
            //             // skip properties if exclude is set
            //             return;
            //                 }

            //                 if let Some(path_params) = path_params.as_ref() {
            //                     if path_params.contains(prop_name) {
            //                         return;
            //                     }

            //                 }

            //                 let ty = self.generate_struct(ctx, prop_schema, None, None);
            //                 if prop_schema.required.unwrap_or(false) {
            //                     arg_strs.push(format!("{}: {}", prop_name.to_case(Case::Snake), ty));

            //                 } else {
            //                     default_arg_strs.push(format!("{}: Optional[{}] = None", prop_name.to_case(Case::Snake), ty));

            //                 }
            //             });
            //         }
            //     }

            //     // handle path parameters
            //     match get_method_path_names_and_tys(method)? {
            //         Some((props, tys)) => {
            //             for (i, prop) in props.iter().enumerate() {
            //                 arg_strs.push(format!("{}: {}", prop.to_case(Case::Snake), tys[i]));
            //             }
            //         }
            //         None => {}
            //     }

            //     let arg_str = arg_strs.join(", ");
            //     if !arg_str.is_empty() {
            //         result += &arg_str;
            //     }

            //     result += ")";

            //     let mut result_type: String = "None".to_string();

            //     let mut has_res = false;
            //     // generate response
            //     if let Some(res) = &method.res {
            //         has_res = true;
            //         let response_ty = get_response_name(ctx, method_name);
            //         self.generate_struct(ctx, &res, Some(response_ty.clone()), None);
            //         result_type = response_ty;

            //     }

            //     result += &format!(" -> {}", result_type);

            //     result += ":\n";

            //     // let mut has_request = false;
            //     let mut request_fields:Vec<String> = Vec::new();

            //     // collect extra fields, which should not be assigned from body or path/query variable
            //     let mut extra_props:HashSet<String> = HashSet::new();

            //     // handle extra request fields (global level)
            //     match self.get_gen_option(ctx) {
            //         Some(gen_opt) => {
            //             if let Some(extra_request_fields) = &gen_opt.extra_request_fields {
            //                 for field in extra_request_fields {
            //                     request_fields.push(field.to_string());
            //                     let mut parts = field.split("=");
            //                     if let Some(part) = parts.next() {
            //                         extra_props.insert(part.trim().to_string());
            //                     }
            //                 }
            //             }
            //         },
            //         None => {}
            //     }

            //     // request object creation
            //     if let Some(req) = &method.req {

            //         for (prop_name, prop_schema) in req.properties.as_ref().unwrap() {
            //             if extra_props.contains(prop_name) {
            //                 // skip extra props
            //                 continue;
            //             }
            //             let mut field = String::new();
            //             field += &prop_name.to_case(Case::Snake);
            //             field += "=";

            //             // if property is in body, use body.xxx
            //             // otherwise, use xxx directly
            //             let mut in_path = false;
            //             if let Some(path_params) = path_params.as_ref() {
            //                 if path_params.contains(prop_name)  {
            //                     field += &prop_name.to_case(Case::Snake);
            //                     in_path = true;
            //                 }
            //             }

            //             if !in_path {
            //                 if rest.method == "get" {
            //                     field += &prop_name.to_case(Case::Snake);
            //                 }
            //                 else {
            //                     field += "body.";
            //                     field += &prop_name.to_case(Case::Snake);
            //                 }
            //             }

            //             request_fields.push(field);

            //         }
            //     }

            //     if request_fields.len() != 0 {
            //         result += "  request = ";
            //         result += &get_request_name(ctx, method_name);
            //         result += "(";
            //         result += &request_fields.join(",\n    ");
            //         result += ")\n";
            //     }

            //     if has_res {
            //         result += "  return"
            //     }

            //     let call_usecase = format!("ctx.{}.{}({})", trait_name, method_name.to_case(Case::Snake), if request_fields.len() != 0 {
            //         "request"
            //     } else {
            //         ""
            //     });
            //     let usecase_ty = get_usecase_name(ctx, &trait_name);
            //     result += &call_usecase;
            //     result += "\n";
        }

        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);

        Ok(())
    }
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

impl GolangGinGenerator {
    fn gen_anonymous_struct(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        name: Option<String>,
        form_tag_props: Option<HashSet<String>>,
        uri_tag_props: Option<HashSet<String>>,
        json_tag_props: Option<HashSet<String>>,
    ) -> Result<String> {
        let mut result = String::new();
        result += "struct {\n";
        for (prop_name, prop_schema) in schema.properties.as_ref().unwrap() {
            if prop_schema
                .option
                .as_ref()
                .and_then(|o| o.golang_gin.as_ref().and_then(|opt| opt.exclude))
                .unwrap_or(false)
            {
                // skip properties if exclude is set
                continue;
            }
            let ty = if prop_schema.items.is_some() {
                // if items is set, it is an array type
                let item_ty = prop_schema
                    .items
                    .as_ref()
                    .and_then(|items| items.ty.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("items type is not set for {}", prop_name))?;
                let ty = spec_ty_to_golang_builtin_ty(item_ty)
                    .unwrap_or_else(|| item_ty.clone());
                format!("[]{}", ty)
                
            } else {
                spec_ty_to_golang_builtin_ty(prop_schema.ty.as_ref().unwrap())
                .unwrap_or_else(|| prop_schema.ty.as_ref().unwrap().clone())
            };
            
           
            let actual_ty = if prop_schema.required.unwrap_or(false) {
                // if required, use the type directly
                ty
            } else {
                // if not required, use pointer type
                format!("*{}", ty)
            };
            let camel_prop_name = prop_name.to_case(Case::Camel);
            let upper_camel_prop_name = camel_prop_name.to_case(Case::UpperCamel);
            let mut tags: Vec<String> = Vec::new();
            if let Some(json_props) = json_tag_props.as_ref() {
                if json_props.contains(&camel_prop_name) {
                    tags.push(format!("json:\"{}\"", camel_prop_name));
                }
            }

            if let Some(form_props) = form_tag_props.as_ref() {
                if form_props.contains(&camel_prop_name) {
                    tags.push(format!("form:\"{}\"", camel_prop_name));
                }
            }

            if let Some(uri_props) = uri_tag_props.as_ref() {
                if uri_props.contains(&camel_prop_name) {
                    tags.push(format!("uri:\"{}\"", camel_prop_name));
                }
            }
            let tags_str = if tags.is_empty() {
                "".to_string()
            } else {
                format!("`{}`", tags.join(" "))
            };
            result += &format!("  {} {} {}\n", upper_camel_prop_name, actual_ty, tags_str);
        }
        result += "}";
        Ok(result)
    }

    fn gen_usecase_method(
        &self,
        ctx: &Ctxt,
        usecase_var: &str,
        domain_pkg: &str,
        method_name: &str,
        method: &RawUsecaseMethod,
    ) -> Result<String> {
        let mut result = String::new();
        let domain_package = self
            .get_gen_option(ctx)
            .and_then(|gen_opt| gen_opt.domain_package.as_ref())
            .ok_or_else(|| anyhow::anyhow!("golang_gin domain_package option is not set"))?;
        let rest = method
            .option
            .as_ref()
            .and_then(|option| option.rest.as_ref())
            .ok_or_else(|| anyhow::anyhow!("No rest option for method {}", method_name))?;
        result += "func (ctx *gin.Context) {\n";

        let (path_params, query_params, body_params) = utils::get_pqb(method);
        let is_multipart = method
            .option
            .as_ref()
            .and_then(|opt| opt.rest.as_ref())
            .and_then(|rest_opt| rest_opt.content_type.as_ref())
            .and_then(|ct| Some(ct == "multipart/form-data"))
            .unwrap_or(false);

        let form_tag_props: Option<HashSet<String>> = if is_multipart {
            // query_params + body_params
            let mut combined: Option<HashSet<String>> = query_params.clone();
            if combined.is_none() {
                combined = body_params.clone();
            } else { 
                if let Some(body_params) = &body_params{
                    combined.as_mut().unwrap().extend(body_params.iter().cloned());
                }
            }
            combined
        } else {
            // only query params for non-multipart
            query_params.clone()
        };

        // request variable creation
        if let Some(req) = &method.req {
            let request_ty = get_request_name(ctx, method_name);
            result += &format!(
                "  var request {}\n",
                self.gen_anonymous_struct(
                    ctx,
                    req,
                    Some(request_ty.clone()),
                    form_tag_props,
                    path_params.clone(),
                    if is_multipart {None} else {body_params }
                )?
            );
        }

        
        // path variable extraction
        if path_params.is_some() {
            result += " if err := ctx.ShouldBindUri(&request); err != nil {\n";
            result += "    ctx.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n";
            result += "    return\n";
            result += "  }\n";
        }

        let mut extra_fields: Vec<String> = Vec::new();

        // handle extra request fields (generator level)
        if let Some(extra_request_fields) = self
            .get_gen_option(ctx)
            .as_ref()
            .and_then(|opt| opt.extra_request_fields.as_ref())
        {
            extra_fields.extend(extra_request_fields.iter().cloned());
        }

        // handle extra request fields (method level)
        if let Some(extra_request_fields) = method
            .option
            .as_ref()
            .and_then(|opt| opt.golang_gin.as_ref())
            .and_then(|py_opt| py_opt.extra_request_fields.as_ref())
        {
            extra_fields.extend(extra_request_fields.iter().cloned());
        }

        let all_fields: HashSet<String> = method
            .req
            .as_ref()
            .and_then(|req| req.properties.as_ref())
            .map_or_else(HashSet::new, |props| {
                props
                    .iter()
                    .map(|(k, _)| k.to_string().to_case(Case::UpperCamel))
                    .collect::<HashSet<String>>()
            });

        // remove extra fields from all fields if they are not present in the request
        extra_fields.retain(|field| {
            all_fields.contains(&field.split(':').next().unwrap().trim().to_string())
        });

        if method.req.is_some() {
            // if get, use query parameters
            if rest.method == "get" {
                result += "  if err := ctx.ShouldBindQuery(&request); err != nil {\n";
                result += "    ctx.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n";
                result += "    return\n";
                result += "  }\n";
            } else {
                if is_multipart {
                    // multipart/form-data, use
                    result += "  if err := ctx.ShouldBind(&request); err != nil {\n";
                    result +=
                        "    ctx.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n";
                    result += "    return\n";
                    result += "  }\n";
                } else {
                    // default to ShouldBindJSON for other methods
                    // if post, delete, put, patch, use body parameters

                    result += "  if err := ctx.BindJSON(&request); err != nil {\n";
                    result +=
                        "    ctx.JSON(http.StatusBadRequest, gin.H{\"error\": err.Error()})\n";
                    result += "    return\n";
                    result += "  }\n";
                }
            }
        }

        if method.req.is_some() || !extra_fields.is_empty() {
            let request_ty = get_request_name(ctx, method_name);
            result += &format!(" domain_request := {}.{}{{\n", domain_package, request_ty);

            // handle extra request fields
            if !extra_fields.is_empty() {
                for field in extra_fields {
                    result += &field;
                    result += ",\n";
                }
            }

            if let Some(req) = &method.req {
                for (prop_name, prop_schema) in req.properties.as_ref().unwrap() {
                    if prop_schema
                        .option
                        .as_ref()
                        .and_then(|o| o.golang_gin.as_ref().and_then(|opt| opt.exclude))
                        .unwrap_or(false)
                    {
                        // skip properties if exclude is set
                        continue;
                    }
                    let upper_camel_prop_name = prop_name.to_case(Case::UpperCamel);
                    // let passed_by = if prop_schema.required.unwrap_or(false) {
                    //     ""
                    // } else {
                    //     "&"
                    // };
                    result += &format!(
                        "  {}: request.{},\n",
                        upper_camel_prop_name, upper_camel_prop_name
                    );
                }
            }

            result += "  }\n";
        }

        let has_res = method.res.is_some();
        let res_var = if has_res { "response, " } else { "" };
        result += &format!(
            "  {} err := {}.{}(ctx, &domain_request)\n",
            res_var,
            usecase_var,
            method_name.to_case(Case::UpperCamel)
        );
        result += "  if err != nil {\n";
        result += "    ctx.JSON(http.StatusInternalServerError, gin.H{\"error\": err.Error()})\n";
        result += "    return\n";
        result += "  }\n";
        if has_res {
            result += "  ctx.JSON(http.StatusOK, response)\n";
        } else {
            result += "  ctx.Status(http.StatusNoContent)\n";
        }

        result += "}";
        Ok(result)
    }
    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a GolangGinGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| {
            go.generator
                .as_ref()
                .and_then(|gen| gen.golang_gin.as_ref())
        })
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "generated.go";

        self.get_gen_option(ctx)
            .and_then(|gen| {
                Some(get_path_from_optional_parent(
                    gen.def_loc.file.parent(),
                    gen.file.as_ref(),
                    default_file,
                ))
            })
            .unwrap_or_else(|| default_file.into())
    }
}
