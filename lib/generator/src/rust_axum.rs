use std::{cell::RefCell, collections::HashMap, hash::Hash, path::PathBuf};

use anyhow::{ bail, Ok, Result};
use convert_case::{Case, Casing};
use cronus_spec::{RawUsecase, RawUsecaseMethod, RawUsecaseMethodRestOption, RustAxumGeneratorOption};
use tracing::{span, Level};

use crate::{utils::{self, get_path_from_optional_parent, get_request_name, get_usecase_name}, Ctxt, Generator};



pub struct RustAxumGenerator {
    /// routes to register in function init_router
    /// path => http type, route function
    routes: RefCell<HashMap<String, Vec<(String, String)>>>
}

impl RustAxumGenerator {
    pub fn new() -> Self {
        Self {
            routes: Default::default()
        }
    }
}

impl Generator for RustAxumGenerator {
    fn name(&self) -> &'static str {
        "rust_axum"
    }

    fn before_all(&self, ctx: &Ctxt) -> Result<()> {
        ctx.append_file(self.name(), &self.dst(ctx), self.axum_dependencies());
        Ok(())
    }

    fn generate_usecase(&self, ctx: &Ctxt, usecase_name: &str, usecase: &cronus_spec::RawUsecase) -> anyhow::Result<()> {

        for (method_name, method) in &usecase.methods {
            match method.option {
                Some(ref option) => {
                    if let Some(rest) = &option.rest {
                        self.generate_method(ctx, usecase_name,usecase,&method_name, method, rest)?;
                    }
                },
                None => {},
            }
        }

        Ok(())
    }

    fn after_all(&self, ctx: &Ctxt) -> Result<()> {
        // generate app state trait
        ctx.append_file(self.name(), &self.dst(ctx), &self.gen_app_state_trait(ctx));
        self.generate_router_init(ctx);
        Ok(())
    }

}

fn gen_method_query_struct(method: &RawUsecaseMethod, query_type:&str) -> Option<String> {
    let mut query_params: Vec<String> = Vec::new();
    if let Some(req) = &method.req {
        if let Some(properties) = &req.properties {
            for (name, schema) in properties {
                if let Some(option) = &schema.option {
                    if let Some(rest_option) = &option.rest {
                        if rest_option.query.unwrap_or(false) {
                            let ty = if let Some(t) = utils::spec_ty_to_rust_builtin_ty(schema.ty.as_ref().unwrap()) {
                                t
                            } else {
                               schema.ty.as_ref().unwrap().clone()
                            };
                            query_params.push(format!("pub {}: {}", name, ty));
                        }
                    }
                }
            }
        }
    }

    if !query_params.is_empty() {
        let struct_def = format!(
            "#[derive(Debug, Serialize, Deserialize)]\n\
            pub struct {} {{\n    {}\n}}\n",
            query_type,
            query_params.join(",\n    ")
        );
        Some(struct_def)
    } else {
        None
    }
}

fn get_method_path_names_and_tys(method: &RawUsecaseMethod) -> Result<Option<(Vec<String>, Vec<String>)>> {
    let path_params = utils::get_path_params(method);
    let mut struct_fields: Vec<String> = Vec::new();
    let mut struct_tys: Vec<String> = Vec::new();
    match path_params {
        Some(path_params) => {
            for prop in &path_params {
                let prop_schema = method.req.as_ref().unwrap().properties.as_ref().unwrap()
                .get(prop).unwrap();

                let ty: String;

                if prop_schema.items.is_some() {
                    bail!("array property cannot be used as path variable")
                }

                if let Some(t) = utils::spec_ty_to_rust_builtin_ty(prop_schema.ty.as_ref().unwrap()) {
                    ty = t;
                } else {
                    ty = prop_schema.ty.as_ref().unwrap().clone();
                }


                struct_fields.push(prop.clone());
                struct_tys.push(ty);
            }

            Ok(Some((struct_fields, struct_tys)))
        },
        None =>Ok(None),
    }

}

fn geenerate_usecase_method_query_type(usecase_name:&str, method_name: &str) -> String {
    format!("{}_{}_Query", usecase_name, method_name,).to_case(convert_case::Case::UpperCamel)
}



impl RustAxumGenerator {


    /// Generate the axum handler for the usecase's method with http option
    ///
    /// pub async fn <method_name>(State(state): State<Arc<AppState>>, Json(request): Json<request_name>)
    ///    -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    ///    ...
    /// }
    ///
    /// Except for the state and request, query parameter is also needed if there is a corresponding config in rest option
    /// Query<T>
    ///
    /// Path parameter is also need if there is path templating
    /// Ex. PathExtractor(post_id): PathExtractor<Uuid>
    fn generate_method(&self, ctx: &Ctxt, usecase_name:&str, usecase: &RawUsecase, method_name: &str, method: &cronus_spec::RawUsecaseMethod, rest: &cronus_spec::RawUsecaseMethodRestOption) -> Result<()> {

        let mut result = "pub async fn ".to_owned();
        let fn_name = method_name.to_case(convert_case::Case::Snake);
        result += &fn_name;
        result += &format!("(State(state): State<std::sync::Arc<Usecases>>");

        let mut has_path_or_query  = false;
        // handle path parameters
        match get_method_path_names_and_tys(method)? {
            Some((props, tys)) => {
                result += ", ";
                result += &format!(" axum::extract::Path(({})): axum::extract::Path<({})>",
                    props.join(","),
                    tys.join(",")
                );
                has_path_or_query = true;
            },
            None => {},
        }

        // handle query parameters
        let query_ty = geenerate_usecase_method_query_type(usecase_name, method_name);
        match gen_method_query_struct(method, &query_ty) {
            Some(query_struct) => {
                // add struct definition to file
                ctx.append_file(self.name(), &self.dst(ctx), &query_struct);
                result += &format!(", query: axum::extract::Query<{}>", query_ty);
                has_path_or_query = true;
            },
            None => {},
        }

        if method.req.is_some() {
            if has_path_or_query {
                result += ", Json(mut request): Json<";

            } else {
                result += ", Json(request): Json<";

            }
            result += &get_request_name(ctx, method_name);
            result += ">"
        }

        result += ") -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {\n";

        // handle request's path & query assignment
        // request.xxx = xxx
        match get_method_path_names_and_tys(method)? {
            Some((props, tys)) => {
                let stmts:Vec<String> = props.iter()
                .map(|prop| format!("request.{} = Some({});", prop, prop).to_string())
                .collect();
                result += &stmts.join("\n");

            },
            None => {}
        };

        // request.xxx = query.xxx
        match utils::get_query_params(method) {
            Some(params) => {
                let stmts:Vec<String> = params.iter()
                .map(|prop| format!("request.{} = Some(query.{});", prop, prop).to_string())
                .collect();
                result += &stmts.join("\n");
            },
            None => {

            },
        }

        let req_var = if method.req.is_some() { "request" } else { ""};
        result += &format!(r#"
    match state.{}.{}({}).await {{
        Ok(res) => {{
            Ok(Json(res))
        }},
        Err(err) => {{
            let mut err_obj = serde_json::Map::new();
            err_obj.insert("message".to_owned(), serde_json::Value::from(err.to_string()));
            Err((StatusCode::BAD_REQUEST, Json(serde_json::Value::Object(err_obj))))
        }},
        }}
    "#, usecase_name.to_case(Case::Snake), fn_name, req_var);
        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);

        // prepare routes
        let usecase_prefix = utils::get_usecase_rest_path_prefix(usecase);
        if let Some(options) = &method.option {
            if let Some(rest_option) = &options.rest {
                let method_path = rest_option.path.as_ref().map(|p| if usecase_prefix.ends_with("/") { format!("{}{}", usecase_prefix, p)} else { format!("{}/{}", usecase_prefix, p)} ).unwrap_or(usecase_prefix.clone());
                if self.routes.borrow().get(&method_path).is_some() {
                    self.routes.borrow_mut().get_mut(&method_path).unwrap().push((rest_option.method.clone(), fn_name))
                } else {
                    self.routes.borrow_mut()
                    .insert(method_path, vec![(rest_option.method.clone(), fn_name)]);

                }

            }
        }


        Ok(())

    }

    fn generate_router_init(&self, ctx: &Ctxt) {
        let mut result = "pub fn router_init(usecases: std::sync::Arc<Usecases>) -> Router {\n".to_owned();
        result += "  Router::new()\n";

        let routes = self.routes.borrow();


        for (idx, (path, methods)) in routes.iter().enumerate() {
            result += &"    .route(".to_owned();

            let axum_routes = methods.iter()
            .map(|(ty, func)| {
                format!("{}({})", ty, func)
            })
            .collect::<Vec<String>>()
            .join(".");

            result += &format!("\"{}\", axum::routing::{}", path, axum_routes);
            result += ")";
            if idx < routes.len()-1 {
                result += "\n"
            } else {

                result += "\n    .with_state(usecases)\n"
            }
        }
        
        result += "}\n";
        ctx.append_file(self.name(), &self.dst(ctx), &result);
        
    }

    fn axum_dependencies(&self) -> &'static str {
        return r#"
use axum::{
    extract::State,
    http::{header, Response, StatusCode},
    response::IntoResponse,
    Extension, Json,
    Router
};
"#;
    }

    fn gen_app_state_trait(&self, ctx: &Ctxt) -> String {
        let mut result = "#[derive(Clone)]\npub struct Usecases {\n".to_string();        
        // find which use case is http
        ctx
        .spec
        .usecases
        .iter()
        .flat_map(|m| m.iter())
        .filter(|(name, usecase)| {
            for (method_name, method) in &usecase.methods {
                match method.option {
                    Some(ref option) => {
                        if let Some(rest) = &option.rest {
                            return true;
                        }
                    },
                    None => {},
                }
            }
            return false;
        })
        .for_each(|(name, usecase)|{
            // usecase that contains at least one method that is open to REST
            let usecase_name = get_usecase_name(ctx, name);
            result += &format!("  pub {}: std::sync::Arc<dyn {} + Send + Sync>,\n", name.to_case(Case::Snake), usecase_name);
        });

        result += "}\n";
        
        return result;
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a RustAxumGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| go.generator.as_ref().and_then(|gen| gen.rust_axum.as_ref()))
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "handler.rs";

        self.get_gen_option(ctx)
        .and_then(|gen_opt| {
            Some(get_path_from_optional_parent(
                gen_opt.def_loc.file.parent(),
                gen_opt.file.as_ref(),
                default_file)
            )


        })
        .unwrap_or(default_file.to_string())

    }

    
}


#[cfg(test)]
mod tests {
    use crate::run_generator;

    use super::*;
    use std::{collections::HashMap, path::PathBuf};
    use anyhow::{Ok, Result};
    use cronus_parser::api_parse;

    #[test]
    fn test_axum_path_var() -> Result<()> {
        let api_file: &'static str = r#"
        usecase abc {
            [rest.path = "abcd/:a"]
            [rest.method = "post"]
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
        let g = RustAxumGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs(g.name());
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("handler.rs").unwrap();
        println!("{}", file_content);
        assert!(file_content.contains("axum::extract::Path((a))"));
        Ok(())
    }

    #[test]
    fn test_axum_no_path_var() -> Result<()> {
        let api_file: &'static str = r#"
        usecase abc {
            [rest.path = "abcd"]
            [rest.method = "post"]
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
        let g = RustAxumGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs(g.name());
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("handler.rs").unwrap();
        println!("{}", file_content);
        assert!(!file_content.contains("axum::extract::Path("));
        Ok(())
    }

    #[test]
    fn test_axum_query_var() -> Result<()> {
        let api_file: &'static str = r#"
        usecase abc {
            [rest.path = "abcd"]
            [rest.method = "post"]
            create_abcd {
                in {
                    [rest.query]
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
        let g = RustAxumGenerator::new();
        run_generator(&g, &ctx)?;
        let gfs = ctx.get_gfs(g.name());
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("handler.rs").unwrap();
        println!("{}", file_content);
        assert!(file_content.contains("axum::extract::Query<AbcCreateAbcdQuery>"));
        Ok(())
    }
}