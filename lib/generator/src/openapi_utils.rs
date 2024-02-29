use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenApiDocument {
    pub openapi: String,
    pub info: InfoObject,
    pub paths: HashMap<String, PathItemObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<OpenApiComponentsObject>
    // Other fields like servers, components, security, tags, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenApiComponentsObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schemas: Option<HashMap<String, SchemaObject>>,
}


impl OpenApiComponentsObject {
    pub fn new() -> Self {
        Self {
            schemas: Default::default()
        }
    }
}


impl OpenApiDocument {
    pub fn new(openapi: &str, info: InfoObject) -> Self {
        return Self {
            openapi: openapi.to_owned(),
            info,
            paths: Default::default(),
            components: Default::default(),
        };
    }
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InfoObject {
    pub title: String,
    pub version:  String,
    pub description: Option<String>
    // Other fields like description, termsOfService, contact, license, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParameterObject {
    pub name: String,
    #[serde(rename = "in")]
    pub in_: String, // 'in' is a reserved keyword in Rust

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub required: bool,
    pub schema: SchemaObject
    // Other fields like schema, allowEmptyValue, deprecated, etc. can be added here
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestBodyObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub content: HashMap<String, MediaTypeObject>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaTypeObject {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<SchemaObject>,
    // Additional fields like examples, encoding can be added here
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResponsesObject {
    #[serde(flatten)]
    pub responses: HashMap<String, ResponseObject>,
    // Default responses can be added as additional fields
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResponseObject {
    pub description: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<HashMap<String, MediaTypeObject>>,
    // Additional fields like headers, links can be added here
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

    #[serde(rename = "$ref", skip_serializing_if = "Option::is_none")]
    pub ref_: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub nullable: Option<bool>
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
            ref_: Default::default(),
            nullable: Default::default()
        }
    }
}

impl SchemaObject {
    pub fn new_with_ref(r: String) -> Self {
        Self {
            ref_: Some(r),
            ..Default::default()
        }
    }

    pub fn new_with_type(ty: String) -> Self {
        Self {
            type_: Some(ty),
            ..Default::default()
        }
    }

    pub fn new_with_items(items: Box<SchemaObject>) -> Self {
        Self {
            items: Some(items),
            ..Default::default()

        }
    }
}
