use std::{error::Error, path::PathBuf};

use cronus_generator::Ctxt;
use cronus_spec::RawSpec;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn generate_from_yaml(content: &str) -> Result<String, String> {
    match cronus_parser::from_yaml_str(content) {
        Ok(spec) => {
            let ctx = Ctxt::new(spec);
            match cronus_generator::generate(&ctx) {
                Ok(_) => todo!(),
                Err(_) => todo!(),
            }
        },
        Err(err) => {
            Err(err.to_string())
        },
    }

}


#[wasm_bindgen]
pub fn generate_from_api(content: &str) -> Result<String, String> {
    match cronus_parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            let ctx = Ctxt::new(spec);
            match cronus_generator::generate(&ctx) {
                Ok(_) => todo!(),
                Err(_) => todo!(),
            }
        },
        Err(err) => {
            Err(err.to_string())
        },
    }

}

