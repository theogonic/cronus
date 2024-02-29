use std::{cell::RefCell, collections::{HashMap, HashSet}, fmt::format};

use convert_case::{Case, Casing};
use cronus_spec::{OpenapiGeneratorOption, RawSchema, RawUsecaseMethod};
use tracing::{span, Level};

use crate::{openapi_utils::{InfoObject, MediaTypeObject, OpenApiComponentsObject, OpenApiDocument, OperationObject, ParameterObject, PathItemObject, RequestBodyObject, ResponseObject, ResponsesObject, SchemaObject}, utils::{extract_url_variables, get_path_from_optional_parent, get_request_name, get_response_name, get_schema_by_name, spec_ty_to_openapi_builtin_ty, spec_ty_to_rust_builtin_ty}, Ctxt, Generator};



pub struct OpenAPIGenerator {
    generated_schemas: RefCell<HashMap<String, SchemaObject>>

}

impl OpenAPIGenerator {
    pub fn new() -> Self {
        Self {
            generated_schemas: Default::default()
        }
    }
}

impl Generator for OpenAPIGenerator {
    fn name(&self) -> &'static str {
        return "openapi"
    }

    fn generate(&self, ctx: &Ctxt) {

        let mut api = OpenApiDocument::new("3.0.0", InfoObject{
            title:"doc".to_string(),
            version:"0.0.1".to_string(),
            description: None
        });

        ctx.spec.ty
        .iter()
        .flat_map(|m| m.iter())
        .for_each(|(name, schema)| {self.generate_schema(ctx, schema, Some(name.to_string()), None); });

        ctx.spec
            .usecases
            .iter()
            .flat_map(|m| m.iter())
            .for_each(|(name, usecase)| self.generate_usecase(ctx, name, usecase,&mut api ));


        if !self.generated_schemas.borrow().is_empty() {
            let mut components = OpenApiComponentsObject::new();
            let mut schemas: HashMap<String, SchemaObject> = HashMap::new();

            for (name, schema) in self.generated_schemas.borrow().iter() {
                schemas.insert(name.clone(), schema.clone());
            }

            components.schemas = Some(schemas);

            api.components = Some(components);
        }
        let yaml = serde_yaml::to_string(&api).unwrap();

        ctx.append_file(self.name(), &self.dst(ctx), &yaml);

    }


}

enum SchemaType {
    Ref(String),
    Basic(String),
    Arr(Box<SchemaType>)
}

impl SchemaType {
    fn to_schema_object(self) -> Box<SchemaObject> {
        match self {
            SchemaType::Ref(s) => Box::new(SchemaObject::new_with_ref(openapi_ref_type(&s))),
            SchemaType::Basic(s) => Box::new(SchemaObject::new_with_type(s)),
            SchemaType::Arr(s) => Box::new(SchemaObject::new_with_items(s.to_schema_object()))
        }
    }
}

impl OpenAPIGenerator {
    /// Return the type name
    fn generate_schema(
        &self,
        ctx: &Ctxt,
        schema: &RawSchema,
        override_ty: Option<String>,
        ignore_props: Option<&HashSet<String>>
    ) -> SchemaType {
        let type_name: String;
        if let Some(ty) = &override_ty {
            type_name = ty.to_case(Case::UpperCamel);
        }
        else if schema.items.is_some() {
            return SchemaType::Arr(Box::new(self.generate_schema(ctx, schema.items.as_ref().unwrap(), override_ty, None)));
        }
        else {
            type_name = schema.ty.as_ref().unwrap().clone();
        }


        let span = span!(Level::TRACE, "generate_struct", "type" = type_name);
        // Enter the span, returning a guard object.
        let _enter = span.enter();

        // if type name belongs to built-in type, return directly
        if let Some(ty) = spec_ty_to_openapi_builtin_ty(&type_name) {
            return SchemaType::Basic(ty);
        }

        if self.generated_schemas.borrow().contains_key(&type_name) {
            return SchemaType::Ref(type_name);
        }

        // if it is referenced to a custom type, find and return
        if let Some(ref_schema) = get_schema_by_name(&ctx, &type_name) {
            // check whether schema is a type referencing another user type
            if schema.properties.is_none() && schema.enum_items.is_none() && schema.items.is_none() {
                return self.generate_schema(ctx, ref_schema, Some(type_name.to_string()), None);
            }
        }

        let required: Option<Vec<String>> = schema.properties.as_ref().map(|props| {
            props
                .iter()
                .filter_map(|(key, value)| {
                    if let Some(ignore_props) = ignore_props {
                        if ignore_props.contains(key) {
                            return None;
                        }
                    }
                    if value.required.unwrap_or(false) {
                        Some(key.clone())
                    } else {
                        None
                    }
                })
                .collect()
        });

        // Ok, now we need to create a components-schemas for this custom schema
        let so = SchemaObject {
            type_: schema.ty.clone(),
            format: None, // Add logic for format if needed
            items: schema.items.as_ref().map(|item| {
                self.generate_schema(ctx, item, None, None).to_schema_object()
            }),
            properties: schema.properties.as_ref().map(|props| {
                props
                    .iter()
                    .filter_map(|(key, value)| {
                        if let Some(ignore_props) = ignore_props {
                            if ignore_props.contains(key) {
                                return None;
                            }
                        }
                        let obj =  self.generate_schema(ctx, value, None, None).to_schema_object();

                        Some((key.clone(), *obj))
                    })
                    .collect()
            }),
            required: required.and_then(|arr| if arr.is_empty() { None } else {Some(arr)}),
            enum_: schema.enum_items.as_ref().map(|enum_items| {
                enum_items.iter().map(|item| item.name.clone()).collect()
            }),
            all_of: None, // Add logic for allOf if needed
            one_of: None, // Add logic for oneOf if needed
            any_of: None, // Add logic for anyOf if needed
            not: None,    // Add logic for not if needed
            description: schema.option.as_ref().and_then(|o| o.description.clone()),
            default: None, // Add logic for default if needed
            ref_: None,
            nullable: None
        };

        self.generated_schemas.borrow_mut().insert(type_name.clone(), so);

        SchemaType::Ref(type_name)
    }

    fn dst(&self, ctx: &Ctxt) -> String {
        let default_file = "openapi.yaml";

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

    fn generate_usecase(&self, ctx: &Ctxt, name: &str, usecase: &cronus_spec::RawUsecase, openapi: &mut OpenApiDocument) {
        let usecase_prefix = usecase.option.as_ref()
            .and_then(|opt| opt.rest.as_ref())
            .and_then(|rest_opt| rest_opt.path.as_ref())
            .map(|p| if p.starts_with('/') { p.clone() } else { format!("/{}", p) })
            .unwrap_or_else(|| "/".to_string());

        for (method_name, method) in &usecase.methods {
            if let Some(options) = &method.option {
                if let Some(rest_option) = &options.rest {
                    let method_path = rest_option.path.as_ref().map(|p| if usecase_prefix.ends_with("/") { format!("{}{}", usecase_prefix, p)} else { format!("{}/{}", usecase_prefix, p)} ).unwrap_or(usecase_prefix.clone());
                    let path_item = openapi.paths.entry(method_path).or_insert_with(PathItemObject::default);
                    let mut operation = self.create_operation_object(ctx, method_name, method);
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

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a OpenapiGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| go.generator.as_ref().and_then(|gen| gen.openapi.as_ref()))
    }

    fn create_operation_object(&self, ctx: &Ctxt, name:&str, method: &RawUsecaseMethod) -> OperationObject {

        // path parameters like /abc/:var, var is the path parameter
        // query parameters like /abc?var=xxx , var is the query parameter
        let path_params: Option<HashSet<String>> = method.option.as_ref().and_then(|option| {
            option.rest.as_ref().and_then(|rest|{
                rest.path.as_ref().and_then(|path| Some(extract_url_variables(path).into_iter().collect()))
            })
        });

        let mut query_params: HashSet<String> = Default::default();

        // parameters include path and query parameters
        let parameters = method.req.as_ref().map(|req| {
            req.properties
                .as_ref()
                .unwrap_or(&HashMap::new())
                .iter()
                .filter_map(|(key, schema)| {
                    schema.option.as_ref().and_then(|option| {
                        option.rest.as_ref().and_then(|rest_option| {
                            let is_path_var = path_params.as_ref().is_some_and(|path_params| path_params.contains(key));
                            let is_query_var = rest_option.query.unwrap_or(false);
                            if is_query_var {
                                query_params.insert(key.clone());
                            }
                            if is_path_var || is_query_var {
                                Some(ParameterObject {
                                    name: key.clone(),
                                    in_: if is_path_var {
                                        "path".to_string()
                                    } else {
                                        "query".to_string()
                                    },
                                    description: schema.option.as_ref().and_then(|d| d.description.clone()),
                                    required: schema.required.unwrap_or(false),
                                    schema: *self.generate_schema(ctx, schema, None, None).to_schema_object()
                                })
                            } else {
                                None
                            }
                        })
                    })
                })
                .collect::<Vec<ParameterObject>>()
        });
    
        // For the response, the type should be created in the components-schemas,
        // and use $ref in the response type

        let responses = ResponsesObject {
            responses: {
                let mut response_map = HashMap::new();
                let response_schema = match &method.res {
                    Some(res) => {
                        let res_ty = get_response_name(ctx, name);
                        *(self.generate_schema(ctx, res, Some(res_ty), None).to_schema_object())

                    },
                    None => {
                        let mut so:SchemaObject = Default::default();
                        so.type_ = Some("object".into());
                        so.nullable = Some(true);
                        so
                    },
                };

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
                content: {
                    let req_ty = get_request_name(ctx, name);
                    let mut query_and_path = query_params.clone();
                    if let Some(path_params) = path_params {
                        query_and_path.extend(path_params);
                    }
                    HashMap::from([(
                        "application/json".to_string(),
                        MediaTypeObject {
                            schema: Some(*self.generate_schema(ctx, req, Some(req_ty), Some(&query_and_path)).to_schema_object()),
                        },
                )])
                },
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
}

fn openapi_ref_type(s: &String) -> String {
    format!("#/components/schemas/{}", s)
}



#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, path::PathBuf};
    use anyhow::{Ok, Result};
    use cronus_parser::api_parse;

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
        println!("{}", file_content);

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
        assert!(response_schema.properties.is_none());
        assert!(response_schema.ref_.is_some());
        let ref_response_schema = doc.components.as_ref().unwrap().schemas.as_ref().unwrap().get("CreateAbcdResponse").unwrap();
        assert!(ref_response_schema.properties.as_ref().unwrap().contains_key("b"));
        assert_eq!(ref_response_schema.properties.as_ref().unwrap().get("b").unwrap().type_.as_ref().unwrap(), "string");



        Ok(())
    }

}