use std::{cell::RefCell, path::PathBuf};

use convert_case::{Case, Casing};
use cronus_spec::{RawUsecaseMethodRestOption};
use tracing::{span, Level};

use crate::{Generator, Ctxt, utils::{get_usecase_suffix, get_request_name, get_usecase_name}};



pub struct RustAxumGenerator {
    /// routes to register in function init_router
    /// Tuple: handler function name, rest option
    routes: RefCell<Vec<(String, RawUsecaseMethodRestOption)>>
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
        return "rust_axum"
    }

    fn generate(&self, ctx: &Ctxt) {
        let span = span!(Level::TRACE, "RustAxumGenerator");
        let _enter = span.enter();
        ctx.append_file(self.name(), &self.dst(ctx), self.axum_dependencies());

        ctx.spec
            .usecases
            .iter()
            .flat_map(|m| m.iter())
            .for_each(|(name, usecase)| self.generate_usecase(ctx, name, usecase));

        // generate app state trait
        ctx.append_file(self.name(), &self.dst(ctx), &self.gen_app_state_trait(ctx));

        self.generate_router_init(ctx)
    }
}

impl RustAxumGenerator {

    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &cronus_spec::RawUsecase) {

        for (method_name, method) in &usecase.methods {
            match method.option {
                Some(ref option) => {
                    if let Some(rest) = &option.rest {
                        self.generate_method(ctx, name,&method_name, method, rest);
                    }
                },
                None => {},
            }
        }

    }


    /// Generate the axum handler for the usecase's method with http option
    ///
    /// pub async fn <method_name>(State(state): State<Arc<AppState>>, Json(request): Json<request_name>)
    ///    -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    ///    ...
    /// } 
    ///
    /// Except for the state and request, path parameter is also needed if there is a corresponding config in rest option
    /// Ex. PathExtractor(post_id): PathExtractor<Uuid>
    fn generate_method(&self, ctx: &Ctxt, usecase_name:&str, method_name: &str, method: &cronus_spec::RawUsecaseMethod, rest: &cronus_spec::RawUsecaseMethodRestOption) {

        let mut result = "pub async fn ".to_owned();
        let fn_name = method_name.to_case(convert_case::Case::Snake);
        result += &fn_name;
        result += &format!("(State(state): State<std::sync::Arc<Usecases>>");

        if method.req.is_some() {
            result += ", Json(request): Json<";
            result += &get_request_name(ctx, method_name);
            result += ">"
        }
      
        result += ") -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {\n";
        
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
        self.routes.borrow_mut()
            .push((fn_name, rest.clone()))
        
    }

    fn generate_router_init(&self, ctx: &Ctxt) {
        let mut result = "pub fn router_init(usecases: std::sync::Arc<Usecases>) -> Router {\n".to_owned();
        result += "  Router::new()\n";
        
        let routes = self.routes.borrow();

        for (idx, (func, option)) in routes.iter().enumerate() {
            result += &"    .route(".to_owned();
            result += &format!("\"{}\", axum::routing::{}({})", option.path.clone().unwrap_or("".to_string()), option.method, func);
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

    fn dst(&self, ctx: &Ctxt) -> String {
        let gen_config = &ctx.spec.option.as_ref().unwrap().generator.as_ref().unwrap().rust_axum.as_ref().unwrap();
        let rel_root = gen_config.def_loc.file.parent().unwrap();

        if let Some(file) = &gen_config.file {
            if PathBuf::from(file).is_absolute() {
                return file.clone();
            }

            return rel_root.join(file).to_str().unwrap().to_string();

        }

        rel_root.join("handler.rs").to_str().unwrap().to_string()
    }

    
}