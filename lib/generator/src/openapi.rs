use std::collections::HashMap;

use spec::{RawSchema, RawUsecaseMethod};

use crate::{openapi_utils::{InfoObject, MediaTypeObject, OpenApiDocument, OperationObject, ParameterObject, PathItemObject, RequestBodyObject, ResponseObject, ResponsesObject, SchemaObject}, Ctxt, Generator};



pub struct OpenAPIGenerator {
}

impl OpenAPIGenerator {
    pub fn new() -> Self {
        Self {
           
        }
    }
}

impl Generator for OpenAPIGenerator {
    fn name(&self) -> &'static str {
        return "openapi"
    }

    fn generate(&self, ctx: &Ctxt) {

        let mut api = OpenApiDocument::new("v3", InfoObject{
            title:"doc".to_string(),
            version:"0.0.1".to_string()
        });

        ctx.spec
            .usecases
            .iter()
            .flat_map(|m| m.iter())
            .for_each(|(name, usecase)| self.generate_usecase(ctx, name, usecase,&mut api ));

        let yaml = serde_yaml::to_string(&api).unwrap();

        ctx.append_file(self.name(), "openapi.yaml", &yaml);

    }
}

impl OpenAPIGenerator {
    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &spec::RawUsecase, openapi: &mut OpenApiDocument) {
        let usecase_prefix = usecase.option.as_ref()
            .and_then(|opt| opt.rest.as_ref())
            .and_then(|rest_opt| rest_opt.path.as_ref())
            .map(|p| if p.starts_with('/') { p.clone() } else { format!("/{}", p) })
            .unwrap_or_else(|| "/".to_string());

        for (method_name, method) in &usecase.methods {
            if let Some(options) = &method.option {
                if let Some(rest_option) = &options.rest {
                    let method_path = rest_option.path.as_ref().map(|p| format!("{}{}", usecase_prefix, p)).unwrap_or(usecase_prefix.clone());
                    let path_item = openapi.paths.entry(method_path).or_insert_with(PathItemObject::default);
                    let mut operation = create_operation_object(method_name, method);
                    operation.tags = Some(vec![name.to_string()]);
                    match rest_option.method.to_lowercase().as_str() {
                        "get" => path_item.get = Some(operation),
                        "put" => path_item.put = Some(operation),
                        "post" => path_item.post = Some(operation),
                        "delete" => path_item.delete = Some(operation),
                        "options" => path_item.options = Some(operation),
                        "head" => path_item.head = Some(operation),
                        "patch" => path_item.patch = Some(operation),
                        "trace" => path_item.trace = Some(operation),
                        _ => {} // Handle unsupported methods or log an error
                    }
                }
            }
        }
    }
}

// Helper function to convert RawSchema to SchemaObject
fn convert_schema_to_object(schema: &RawSchema) -> SchemaObject {
    SchemaObject {
        type_: schema.ty.clone(),
        format: None, // Add logic for format if needed
        items: schema.items.as_ref().map(|item| Box::new(convert_schema_to_object(item))),
        properties: schema.properties.as_ref().map(|props| {
            props
                .iter()
                .map(|(key, value)| (key.clone(), convert_schema_to_object(value)))
                .collect()
        }),
        required: schema.properties.as_ref().map(|props| {
            props
                .iter()
                .filter_map(|(key, value)| {
                    if value.required.unwrap_or(false) {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect()
        }),
        enum_: schema.enum_items.as_ref().map(|enum_items| {
            enum_items.iter().map(|item| item.name.clone()).collect()
        }),
        all_of: None, // Add logic for allOf if needed
        one_of: None, // Add logic for oneOf if needed
        any_of: None, // Add logic for anyOf if needed
        not: None,    // Add logic for not if needed
        description: schema.option.as_ref().and_then(|o| o.description.clone()),
        default: None, // Add logic for default if needed
    }
}

fn convert_schema_to_req_body_object(schema: &RawSchema) -> SchemaObject {
    SchemaObject {
        type_: schema.ty.clone(),
        format: None, // Add logic for format if needed
        items: schema.items.as_ref().map(|item| Box::new(convert_schema_to_req_body_object(item))),
        properties: schema.properties.as_ref().map(|props| {
            props
                .iter()
                .filter_map(|(key, value)| {
                    // Filter out properties marked with path or query
                    if let Some(option) = &value.option {
                        if option.rest.as_ref().map_or(true, |rest| !rest.path.unwrap_or(false) && !rest.query.unwrap_or(false)) {
                            Some((key.clone(), convert_schema_to_req_body_object(value)))
                        } else {
                            None
                        }
                    } else {
                        Some((key.clone(), convert_schema_to_req_body_object(value)))
                    }
                })
                .collect()
        }),
        required: schema.properties.as_ref().map(|props| {
            props
                .iter()
                .filter_map(|(key, value)| {
                    if value.required.unwrap_or(false) {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect()
        }),
        enum_: schema.enum_items.as_ref().map(|enum_items| {
            enum_items.iter().map(|item| item.name.clone()).collect()
        }),
        all_of: None, // Add logic for allOf if needed
        one_of: None, // Add logic for oneOf if needed
        any_of: None, // Add logic for anyOf if needed
        not: None,    // Add logic for not if needed
        description: schema.option.as_ref().and_then(|d| d.description.clone()),
        default: None, // Add logic for default if needed
    }
}

fn create_operation_object(name:&str, method: &RawUsecaseMethod) -> OperationObject {
    let parameters = method.req.as_ref().map(|req| {
        req.properties
            .as_ref()
            .unwrap_or(&HashMap::new())
            .iter()
            .filter_map(|(key, schema)| {
                schema.option.as_ref().and_then(|option| {
                    option.rest.as_ref().and_then(|rest_option| {
                        if rest_option.path.unwrap_or(false) || rest_option.query.unwrap_or(false) {
                            Some(ParameterObject {
                                name: key.clone(),
                                in_: if rest_option.path.unwrap_or(false) {
                                    "path".to_string()
                                } else {
                                    "query".to_string()
                                },
                                description: schema.option.as_ref().and_then(|d| d.description.clone()),
                                required: schema.required.unwrap_or(false),
                            })
                        } else {
                            None
                        }
                    })
                })
            })
            .collect::<Vec<ParameterObject>>()
    });

    let responses = ResponsesObject {
        responses: {
            let mut response_map = HashMap::new();
            let response_schema = method.res.as_ref().map(|res|
                convert_schema_to_object(res)).unwrap_or(SchemaObject {
                type_: Some("object".to_string()),
                // Add additional default properties if needed
                ..Default::default()
            });
            response_map.insert(
                "200".to_string(),
                ResponseObject {
                    description: "Successful response".to_string(),
                    content: Some(HashMap::from([(
                        "application/json".to_string(),
                        MediaTypeObject {
                            schema: Some(response_schema),
                        },
                    )])),
                },
            );
            response_map
        },
    };

    let request_body = method.req.as_ref().map(|req| {
        RequestBodyObject {
            description: None, // Add description if needed
            content: HashMap::from([(
                "application/json".to_string(),
                MediaTypeObject {
                    schema: Some(convert_schema_to_req_body_object(req)),
                },
            )]),
            required: Some(true), // Set to true if the request body is required
        }
    });

    OperationObject {
        summary: Some(format!("Operation for {}", name)),
        // description: method.req.as_ref().and_then(|schema| schema.description.clone()),
        description: None,
        operation_id: Some(name.to_string()),
        parameters,
        request_body,
        responses,
        tags: None
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, path::PathBuf};
    use anyhow::{Ok, Result};
    use parser::api_parse;

    #[test]
    fn test_openapi_get() -> Result<()> {
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
        let g = OpenAPIGenerator::new();
        g.generate(&ctx);
        let gfs = ctx.get_gfs(g.name());
        let gfs_borrow = gfs.borrow();
        let file_content = gfs_borrow.get("openapi.yaml").unwrap();
        let doc: OpenApiDocument = serde_yaml::from_str(&file_content)?;

        assert_eq!(doc.paths.len(), 1);
        assert!(doc.paths.get("/abcd").is_some());
        let post_op = doc.paths.get("/abcd").unwrap().post.as_ref().unwrap();
        assert_eq!(post_op.operation_id, Some("create_abcd".to_string()));

        // Check request body schema
        let request_body = post_op.request_body.as_ref().unwrap();
        let request_schema = request_body.content.get("application/json").unwrap().schema.as_ref().unwrap();
        assert_eq!(request_schema.properties.as_ref().unwrap().len(), 1);
        assert!(request_schema.properties.as_ref().unwrap().contains_key("a"));
        assert_eq!(request_schema.properties.as_ref().unwrap().get("a").unwrap().type_.as_ref().unwrap(), "string");

        // Check response schema
        let response = post_op.responses.responses.get("200").unwrap();
        let response_schema = response.content.as_ref().unwrap().get("application/json").unwrap().schema.as_ref().unwrap();
        assert_eq!(response_schema.properties.as_ref().unwrap().len(), 1);
        assert!(response_schema.properties.as_ref().unwrap().contains_key("b"));
        assert_eq!(response_schema.properties.as_ref().unwrap().get("b").unwrap().type_.as_ref().unwrap(), "string");



        Ok(())
    }

}