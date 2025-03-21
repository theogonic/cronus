use std::{collections::HashMap, error::Error, path::PathBuf};

use cronus_generator::Ctxt;
use cronus_spec::RawSpec;
use wasm_bindgen::prelude::*;


#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &JsValue);

    // Multiple arguments too!
    #[wasm_bindgen(js_namespace = console, js_name = log)]
    fn log_many(a: &JsValue, b: &JsValue);
}


#[wasm_bindgen]
pub fn generate_from_yaml(content: &str) -> Result<JsValue, String> {
    match cronus_parser::from_yaml_str(content) {
        Ok(spec) => {
            run_raw_spec(spec)
        },
        Err(err) => {
            Err(err.to_string())
        },
    }
}

#[wasm_bindgen]
pub fn api_to_yaml(content: &str) -> Result<JsValue, String> {
    match cronus_parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            let yaml = cronus_parser::to_yaml_str(&spec).map_err(|e| e.to_string())?;
            Ok(serde_wasm_bindgen::to_value(&yaml).unwrap())
        },
        Err(err) => {
            Err(err.to_string())
        },
    }
}

fn run_raw_spec(spec: RawSpec) -> Result<JsValue, String> {
    log(&serde_wasm_bindgen::to_value(&spec).unwrap());

    let ctx = Ctxt::new(spec);
    match cronus_generator::generate(&ctx) {
        Ok(_) => {

            let gfs = &*ctx.generator_fs.borrow();
            let  result: HashMap<String, HashMap<String, String>> = gfs
            .iter()
            .map(|(key, value)| {
                let inner_map = value.borrow().clone();
                (key.to_string(), inner_map)
            })
            .collect();
            Ok(serde_wasm_bindgen::to_value(&result).unwrap())
        },
        Err(err) => {
            Err(err.to_string())
        },
    }
}

#[wasm_bindgen]
pub fn generate_from_api(content: &str) -> Result<JsValue, String> {        
    console_error_panic_hook::set_once();

    match cronus_parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            run_raw_spec(spec)
        },
        Err(err) => {
            Err(err.to_string())
        },
    }

}

