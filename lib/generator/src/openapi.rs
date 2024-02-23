use std::collections::HashMap;

use spec::RawUsecaseMethod;

use crate::{Generator, Ctxt, openapi_utils::{OpenApiDocument, OperationObject, InfoObject, PathItemObject, ResponsesObject}};



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
        for (method_name, method) in &usecase.methods {
            if let Some(options) = &method.option {
                if let Some(rest_option) = &options.rest {
                    let path_item = openapi.paths.entry(rest_option.path.clone().unwrap_or("".to_string()).clone()).or_insert_with(PathItemObject::default);
                    let operation = create_operation_object(method_name, method);
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

fn create_operation_object(name:&str, method: &RawUsecaseMethod) -> OperationObject {
    // Create and return an OperationObject based on the RawUsecaseMethod.
    // This function should handle the conversion logic.
    // For simplicity, a basic implementation is provided.
    OperationObject {
        summary: Some(format!("Operation for {}", name)),
        // description: method.req.as_ref().and_then(|schema| schema.description.clone()),
        description: None,
        operationId: Some(name.to_string()),
        parameters: None, // Populate this based on RawSchema if needed
        requestBody: None, // Populate this based on RawSchema if needed
        responses: ResponsesObject {
            responses: HashMap::new() // Populate the responses based on RawSchema
        },
        // Other fields can be set as required
    }
}
