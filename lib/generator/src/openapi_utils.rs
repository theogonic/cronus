use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenApiDocument {
    pub openapi: String,
    pub info: InfoObject,
    pub paths: HashMap<String, PathItemObject>,
    // Other fields like servers, components, security, tags, etc. can be added here
}

impl OpenApiDocument {
    pub fn new(openapi:&str, info:InfoObject) -> Self {
        return Self { openapi:"3.0.0".to_owned(), info, paths: Default::default() }
    }
}
#[derive(Debug, Serialize, Deserialize)]
pub struct InfoObject {
    pub title: String,
    pub version: String,
    // Other fields like description, termsOfService, contact, license, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathItemObject {
    pub get: Option<OperationObject>,
    pub put: Option<OperationObject>,
    pub post: Option<OperationObject>,
    pub delete: Option<OperationObject>,
    pub options: Option<OperationObject>,
    pub head: Option<OperationObject>,
    pub patch: Option<OperationObject>,
    pub trace: Option<OperationObject>,
    // Additional fields like parameters can be added here
}

impl Default for PathItemObject {
    fn default() -> Self {
        PathItemObject {
            get: None,
            put: None,
            post: None,
            delete: None,
            options: None,
            head: None,
            patch: None,
            trace: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationObject {
    pub summary: Option<String>,
    pub description: Option<String>,
    pub operationId: Option<String>,
    pub parameters: Option<Vec<ParameterObject>>,
    pub requestBody: Option<RequestBodyObject>,
    pub responses: ResponsesObject,
    // Other fields like tags, security, servers can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParameterObject {
    pub name: String,
    pub in_: String, // 'in' is a reserved keyword in Rust
    pub description: Option<String>,
    pub required: bool,
    // Other fields like schema, allowEmptyValue, deprecated, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestBodyObject {
    pub description: Option<String>,
    pub content: HashMap<String, MediaTypeObject>,
    pub required: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaTypeObject {
    pub schema: Option<SchemaObject>,
    // Additional fields like examples, encoding can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResponsesObject {
    #[serde(flatten)]
    pub responses: HashMap<String, ResponseObject>,
    // Default responses can be added as additional fields
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResponseObject {
    pub description: String,
    pub content: Option<HashMap<String, MediaTypeObject>>,
    // Additional fields like headers, links can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaObject {
    pub type_: Option<String>, // 'type' is a reserved keyword in Rust
    pub format: Option<String>,
    pub items: Option<Box<SchemaObject>>,
    // Additional fields like properties, enum, allOf, oneOf, not, etc. can be added here
}