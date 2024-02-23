use std::{error::Error, path::PathBuf};

use generator::Ctxt;
use spec::RawSpec;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn generate_from_yaml(content: &str) -> Result<String, String> {
    match parser::from_yaml_str(content) {
        Ok(spec) => {
            let ctx = Ctxt::new(spec);
            match generator::generate(&ctx) {
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
    match parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            let ctx = Ctxt::new(spec);
            match generator::generate(&ctx) {
                Ok(_) => todo!(),
                Err(_) => todo!(),
            }
        },
        Err(err) => {
            Err(err.to_string())
        },
    }

}

