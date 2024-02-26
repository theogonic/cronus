use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenApiDocument {
    pub openapi: String,
    pub info: InfoObject,
    pub paths: HashMap<String, PathItemObject>,
    // Other fields like servers, components, security, tags, etc. can be added here
}

impl OpenApiDocument {
    pub fn new(openapi: &str, info: InfoObject) -> Self {
        return Self {
            openapi: "3.0.0".to_owned(),
            info,
            paths: Default::default(),
        };
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub get: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub put: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub post: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub delete: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub head: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch: Option<OperationObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
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

    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(rename = "operationId", skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<Vec<ParameterObject>>,

    #[serde(rename = "requestBody", skip_serializing_if = "Option::is_none")]
    pub request_body: Option<RequestBodyObject>,

    pub responses: ResponsesObject,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParameterObject {
    pub name: String,
    #[serde(rename = "in")]
    pub in_: String, // 'in' is a reserved keyword in Rust

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub required: bool,
    // Other fields like schema, allowEmptyValue, deprecated, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestBodyObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub content: HashMap<String, MediaTypeObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MediaTypeObject {
    #[serde(skip_serializing_if = "Option::is_none")]
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

    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<HashMap<String, MediaTypeObject>>,
    // Additional fields like headers, links can be added here
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SchemaObject {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>, // 'type' is a reserved keyword in Rust

    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
    #[serde(rename = "enum", skip_serializing_if = "Option::is_none")]
    pub enum_: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_of: Option<Vec<SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub one_of: Option<Vec<SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub any_of: Option<Vec<SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub not: Option<Box<SchemaObject>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
}

impl Default for SchemaObject {
    fn default() -> Self {
        Self {
            type_: Default::default(),
            items: Default::default(),
            format: Default::default(),
            properties: Default::default(),
            required: Default::default(),
            enum_: Default::default(),
            all_of: Default::default(),
            one_of: Default::default(),
            any_of: Default::default(),
            not: Default::default(),
            description: Default::default(),
            default: Default::default(),
        }
    }
}
