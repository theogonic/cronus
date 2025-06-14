use std::{collections::{HashMap, VecDeque}, error::Error, fs, path::{Path, PathBuf}, sync::Arc};
use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawSchemaEnumItem {
    pub name: String,
    pub value: Option<i32>,
}


#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GlobalOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generator: Option<GeneratorOption>,

    /// Default: "usecase", other popular choices are: "service", etc..
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecase_suffix: Option<String>,

    /// Default: "request", other popular choices are: "input", "req", etc..
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecase_request_suffix: Option<String>,

    /// Default: "response", other popular choices are: "output", "res", etc..
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecase_response_suffix: Option<String>,

    /// If given type(s) is/are mentioned in the spec, do not generate
    pub skip_types: Option<Vec<String>>
}


#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GeneratorOption {
    pub rust: Option<RustGeneratorOption>,
    pub golang: Option<GolangGeneratorOption>,
    pub golang_gin: Option<GolangGinGeneratorOption>,
    pub python: Option<PythonGeneratorOption>,
    pub python_fastapi: Option<PythonFastApiGeneratorOption>,
    pub python_redis: Option<PythonRedisGeneratorOption>,
    pub rust_axum: Option<RustAxumGeneratorOption>,
    pub openapi: Option<OpenapiGeneratorOption>,
    pub typescript: Option<TypescriptGeneratorOption>,
    pub typescript_nestjs: Option<TypescriptNestjsGeneratorOption>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GolangGinGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .go file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    /// Golang Package Name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package: Option<String>,

    /// Golang Domain Generated Package Name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain_package: Option<String>,

    /// Golang Domain Generated Package Import
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain_import: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_request_fields: Option<Vec<String>>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PythonRedisGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .py file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    #[serde(rename = "async", skip_serializing_if = "Option::is_none")]
    pub async_flag: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecase_from: Option<String>,

}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GolangGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .go file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    /// Golang Package Name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PythonFastApiGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .py file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    #[serde(rename = "async", skip_serializing_if = "Option::is_none")]
    pub async_flag: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub get_ctx_from: Option<String>,

    /// where the python usecase types are defined (which module)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecase_from: Option<String>,
    
    pub extra_imports: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_method_args: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_request_fields: Option<Vec<String>>
}





#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TypescriptNestjsGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .ts file
    pub file: Option<String>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TypescriptGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .ts file
    pub file: Option<String>,

}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PythonGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .py file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    #[serde(rename = "async", skip_serializing_if = "Option::is_none")]
    pub async_flag: Option<bool>,


}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RustGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .rs file
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,

    /// Do not place default derive for struct
    #[serde(skip_serializing_if = "Option::is_none")]
    pub no_default_derive: Option<bool>,

    /// Override the built-in default derive for struct
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_derive: Option<Vec<String>>,

    /// Custom extra uses
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uses: Option<Vec<String>>,

    

    #[serde(skip_serializing_if = "Option::is_none")]
    pub no_error_type: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_type: Option<String>,

    #[serde(rename = "async", skip_serializing_if = "Option::is_none")]
    pub async_flag: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub async_trait: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RustAxumGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .rs file
    pub file: Option<String>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Case {
    #[serde(rename = "camel")]
    Camel,
    #[serde(rename = "snake")]
    Snake
}


#[derive(Debug, Serialize, Deserialize)]
pub struct OpenapiGeneratorOption {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    /// Output .rs file
    pub file: Option<String>,

    /// Case for the fields of request, response etc. in OpenAPI spec
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field_case: Option<Case>
}


#[derive(Debug)]
pub struct DefLoc {
    pub file: PathBuf
}

impl DefLoc {
    pub fn new(file: PathBuf) -> Self {
        Self {
            file
        }
    }
}

impl Default for DefLoc {
    fn default() -> Self {
        Self {
            file: PathBuf::new()
        }
    }
}



#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawSchema {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub ty: Option<String>, // 'type' is a reserved keyword in Rust, hence the rename

    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<RawSchema>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, RawSchema>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub enum_items: Option<Vec<RawSchemaEnumItem>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub option: Option<RawSchemaPropertyOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extends: Option<HashMap<String, String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub flat_extends: Option<Vec<String>>,
}

impl RawSchema {
    pub fn new(def_loc: Arc<DefLoc>, ty: String) -> Self {
        Self {
            def_loc,
            ty: Some(ty),
            items: None,
            properties: None,
            required: None,
            namespace: None,
            enum_items: None,
            option: None,
            extends: None,
            flat_extends: None,
        }
    }

    pub fn new_array_ty(def_loc: Arc<DefLoc>, items_ty: String) -> Self {
        Self {
            def_loc: def_loc.clone(),
            ty: None,
            items: Some(Box::new(RawSchema::new(def_loc, items_ty))),
            properties: None,
            required: None,
            namespace: None,
            enum_items: None,
            option: None,
            extends: None,
            flat_extends: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rest: Option<RawSchemaPropertyRestOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub python: Option<RawSchemaPropertyPythonOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rust: Option<RawSchemaPropertyRustOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub openapi: Option<RawSchemaPropertyOpenApiOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub python_fastapi: Option<RawSchemaPropertyPythonFastApiOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub golang_gin: Option<RawSchemaPropertyGolangGinOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>

}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyPythonOption {

}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyOpenApiOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclude: Option<bool>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyGolangGinOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclude: Option<bool>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyPythonFastApiOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclude: Option<bool>
}


#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyRestOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query: Option<bool>
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct RawSchemaPropertyRustOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attrs: Option<Vec<String>>
}
#[derive(Debug, Serialize, Deserialize)]
pub struct RawUsecaseMethod {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub req: Option<RawSchema>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub res: Option<RawSchema>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub option: Option<RawUsecaseMethodOption>
}

  
#[derive(Debug, Serialize, Deserialize)]
pub  struct RawUsecase {
    #[serde(skip)]
    pub def_loc: Arc<DefLoc>,

    pub methods: HashMap<String, RawUsecaseMethod>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub option: Option<RawUsecaseOption>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawUsecaseOption {

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rest: Option<RawUsecaseRestOption>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawUsecaseRestOption {
    /// Http endpoint prefix
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>
}


#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawUsecaseMethodOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rest: Option<RawUsecaseMethodRestOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub redis: Option<RawUsecaseMethodRedisOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub python_fastapi: Option<RawUsecaseMethodPythonFastApiOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub golang_gin: Option<RawUsecaseMethodGolangGinOption>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawUsecaseMethodRedisOption {

    #[serde(skip_serializing_if = "Option::is_none")]
    pub queue_name: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub ack_queue_name: Option<String>
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RawUsecaseMethodGolangGinOption {

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_request_fields: Option<Vec<String>>
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RawUsecaseMethodPythonFastApiOption {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_method_args: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_request_fields: Option<Vec<String>>
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RawUsecaseMethodRestOption {
    pub method: String,
    pub path: Option<String>,
    pub content_type: Option<String>, // e.g. Default is "application/json"
}

/// The schema for a spec
/// 
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawSpec {


    #[serde(rename = "types", skip_serializing_if = "Option::is_none")]
    pub ty: Option<HashMap<String, RawSchema>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub usecases: Option<HashMap<String, RawUsecase>>,


    #[serde(skip_serializing_if = "Option::is_none")]
    pub option: Option<GlobalOption>,


    #[serde(skip_serializing_if = "Option::is_none")]
    pub imports: Option<Vec<String>>,

}


impl RawSpec {


    pub fn merge(&mut self, to_merge: RawSpec)-> Result<()> {
        if let Some(to_merge_ty) = to_merge.ty {
            let ty_map = self.ty.get_or_insert_with(HashMap::new);
            for (key, value) in to_merge_ty {
                if ty_map.contains_key(&key) {
                    bail!("Conflict for key '{}' in 'ty' hashmap", key);
                }
                ty_map.insert(key, value);
            }
        }

        // Merge 'usecase' HashMap
        if let Some(to_merge_usecase) = to_merge.usecases {
            let usecase_map = self.usecases.get_or_insert_with(HashMap::new);
            for (key, value) in to_merge_usecase {
                if usecase_map.contains_key(&key) {
                    bail!("Conflict for key '{}' in 'usecase' hashmap", key)
                }
                usecase_map.insert(key, value);
            }
        }

        // Global option has to be putted into the entry .api or .yaml file

        // Merge 'imports' Vec
        if let Some(to_merge_imports) = to_merge.imports {
            if let Some(imports) = &mut self.imports {
                for import in &to_merge_imports {
                    if imports.contains(import) {
                        continue;
                    }
                }
                imports.extend(to_merge_imports);
            } else {
                self.imports = Some(to_merge_imports);
            }
        }

        Ok(())
    }

    pub fn new() -> Self {
         Self { 
            ty: Default::default(), 
            usecases: Default::default(), 
            option: Default::default(), 
            imports: Default::default()
         }
    }
}

