use anyhow::bail;
use convert_case::{Case, Casing};
use cronus_spec::{
    JavaSpringWebGeneratorOption, RawSchema, RawMethod,
    RawMethodRestOption,
};
use std::{any::type_name, cell::RefCell, collections::HashSet, fmt::format, path::PathBuf};

use crate::{
    utils::{
        self, get_path_from_optional_parent, get_request_name, get_response_name,
        get_schema_by_name, get_usecase_name, spec_ty_to_java_builtin_ty,
    },
    Ctxt, Generator,
};
use anyhow::{Ok, Result};
use tracing::{self, debug, span, Level};

pub struct JavaSpringWebGenerator {}

impl JavaSpringWebGenerator {
    pub fn new() -> Self {
        Self {}
    }
}

impl Generator for JavaSpringWebGenerator {
    fn name(&self) -> &'static str {
        "java_springweb"
    }


    /// Generate the Spring MVC controller for the given usecase.
    fn generate_usecase(
        &self,
        ctx: &Ctxt,
        name: &str,
        usecase: &cronus_spec::RawUsecase,
    ) -> Result<()> {
        let span = span!(Level::TRACE, "generate_usecase", "usecase" = name);
        let _enter = span.enter();

        let has_rest_methods = usecase.methods.iter().any(|(_, method)| {
            method
                .option
                .as_ref()
                .and_then(|option| option.rest.as_ref())
                .is_some()
        });

        if !has_rest_methods {
            return Ok(());
        }

        let full_usecase_name = get_usecase_name(ctx, name);


        let mut result = String::new();

        // Add package declaration
        let gen_opt = self.get_gen_option(ctx);
        let pkg_name = gen_opt
            .and_then(|opt| opt.package.as_ref())
            .ok_or_else(|| anyhow::anyhow!("java_springweb package option is not set"))?; 

        result += &format!("package {};\n\n", pkg_name);

        // Add imports
        result += &common_imports();
        result += "\n";


        // Add business logic imports
         let domain_import = gen_opt
            .and_then(|opt| opt.domain_import.as_ref())
            .ok_or_else(|| anyhow::anyhow!("java_springweb domain_import option is not set"))?;

        if !domain_import.is_empty() {
            result += &format!("import {}.*;\n\n", domain_import);
        }
        
        // Add extra imports
        let mut extra_imports = Vec::new();
        if let Some(extra_imports_opt) = gen_opt
            .and_then(|opt| opt.extra_imports.as_ref())
        {
            extra_imports.extend(extra_imports_opt.iter().cloned());
        }

        for import in extra_imports {
            result += &format!("import {};\n", import);
        }


        

        let path_prefix = usecase
            .option
            .as_ref()
            .and_then(|usecase_opt| usecase_opt.rest.as_ref())
            .and_then(|rest| rest.path.as_ref())
            .cloned()
            .unwrap_or_default();

        let controller_name = format!("{}Controller", full_usecase_name);
        let service_field = format!("{}Service", name.to_case(Case::Camel));

        result += "@RestController\n";
        if !path_prefix.is_empty() {
            result += &format!("@RequestMapping(\"{}\")\n", path_prefix);
        }
        result += &format!("public class {} {{\n\n", controller_name);

        // Add service field
        result += "    @Autowired\n";
        result += &format!("    private {} {};\n\n",  full_usecase_name, service_field);

        for (method_name, method) in &usecase.methods {
            let rest = match method.option {
                Some(ref option) => {
                    if let Some(rest) = &option.rest {
                        rest
                    } else {
                        continue;
                    }
                }
                None => continue,
            };

            result += &self.gen_controller_method(ctx, &service_field, &method_name, method)?;
            result += "\n";
        }

        result += "}\n";
         let dest_dir = self.dst_dir(ctx);
        let dst_file = PathBuf::from(dest_dir).join(format!("{}.java", controller_name));
        ctx.append_file(self.name(), &dst_file.to_str().unwrap(), &result);

        Ok(())
    }
}

impl JavaSpringWebGenerator {
    fn gen_controller_method(
        &self,
        ctx: &Ctxt,
        service_field: &str,
        method_name: &str,
        method: &RawMethod,
    ) -> Result<String> {
        let mut dto_result = String::new();
        let mut result = String::new();
        let rest = method
            .option
            .as_ref()
            .and_then(|option| option.rest.as_ref())
            .ok_or_else(|| anyhow::anyhow!("No rest option for method {}", method_name))?;

        let binding = String::new();
        let rest_path = rest.path.as_ref().unwrap_or(&binding);
        let http_method = rest.method.to_uppercase();
        let java_method_name = method_name.to_case(Case::Camel);

        let (path_params, query_params, body_params) = utils::get_pqb(method, |prop| {
            prop.option.as_ref()
                .and_then(|o| o.java_springweb.as_ref())
                .and_then(|j| j.exclude)
                .unwrap_or(false)
        });
        let is_multipart = method
            .option
            .as_ref()
            .and_then(|opt| opt.rest.as_ref())
            .and_then(|rest_opt| rest_opt.content_type.as_ref())
            .and_then(|ct| Some(ct == "multipart/form-data"))
            .unwrap_or(false);

        // Add Spring mapping annotation
        match http_method.as_str() {
            "GET" => result += &format!("    @GetMapping(\"{}\")\n", rest_path),
            "POST" => result += &format!("    @PostMapping(\"{}\")\n", rest_path),
            "PUT" => result += &format!("    @PutMapping(\"{}\")\n", rest_path),
            "DELETE" => result += &format!("    @DeleteMapping(\"{}\")\n", rest_path),
            "PATCH" => result += &format!("    @PatchMapping(\"{}\")\n", rest_path),
            _ => result += &format!("    @RequestMapping(value = \"{}\", method = RequestMethod.{})\n", rest_path, http_method),
        }

        // Method signature
        let return_type = if method.res.is_some() {
            let response_ty = get_response_name(ctx, method_name);
            response_ty
        } else {
            "void".to_string()
        };

        result += &format!("    public {} {}(", return_type, java_method_name);

        let mut method_params = Vec::new();

        // handle extra parameters
        if let Some(extra_params) = self.get_gen_option(ctx)
            .and_then(|opt| opt.extra_method_parameters.as_ref())
        {
            for param in extra_params {
                method_params.push(param.clone());
            }
        }

        if let Some(req) = &method.req {
            // Handle path parameters
            if let Some(path_params) = &path_params {
                for param in path_params {
                    let prop_schema = req.properties.as_ref().unwrap().get(param).unwrap();
                    let param_type = self.get_java_type(prop_schema)?;
                    method_params.push(format!("@PathVariable {} {}", param_type, param.to_case(Case::Camel)));
                }
            }

            // Handle query parameters  
            if let Some(query_params) = &query_params {
                for param in query_params {
                    let prop_schema = req.properties.as_ref().unwrap().get(param).unwrap();
                    let param_type = self.get_java_type(prop_schema)?;
                    let required = prop_schema.required.unwrap_or(false);
                    if required {
                        method_params.push(format!("@RequestParam {} {}", param_type, param.to_case(Case::Camel)));
                    } else {
                        method_params.push(format!("@RequestParam(required = false) {} {}", param_type, param.to_case(Case::Camel)));
                    }
                }
            }

            // Handle request body
            if let Some(body_params) = &body_params {
                if !body_params.is_empty() {
                    if is_multipart {
                        // Handle multipart form data
                        for param in body_params {
                            let prop_schema = req.properties.as_ref().unwrap().get(param).unwrap();
                            let param_type = self.get_java_type(prop_schema)?;
                            method_params.push(format!("@RequestParam {} {}", param_type, param.to_case(Case::Camel)));
                        }
                    } else {
                        // Handle JSON request body
                        let (dto_name, dto_decl) = self.gen_body_dto(&method_name, method.req.as_ref().unwrap(), body_params)?;
                        dto_result += &dto_decl;
                        method_params.push(format!("@RequestBody {} body", dto_name));
                    }
                }
            } 
        }

        result += &method_params.join(", ");
        result += ") throws Exception {\n";

        // Method body

        // Prepare domain request if needed
        if let Some(req) = &method.req {
            let request_ty = get_request_name(ctx, method_name);
            
            
            // Build request object from parameters
            result += &format!("        {} request = new {}();\n", request_ty, request_ty);

            for (prop_name, prop_schema) in req.properties.as_ref().unwrap() {
                // Skip properties that are excluded
                if prop_schema.option.as_ref()
                    .and_then(|o| o.java_springweb.as_ref())
                    .and_then(|j| j.exclude)
                    .unwrap_or(false) {
                    continue;
                }


                let java_prop_name = prop_name.to_case(Case::Camel);
                let setter_name = format!("set{}", prop_name.to_case(Case::UpperCamel));
                if body_params.as_ref().is_some_and(|bp| bp.contains(prop_name)) {
                    // If it's a body parameter, use the body object
                    result += &format!("        request.{}(body.get{}());\n", setter_name, prop_name.to_case(Case::UpperCamel));
                } else {
                    result += &format!("        request.{}({});\n", setter_name, java_prop_name);

                }
            }
            

            // Add extra request statements
            let mut extra_stmts: Vec<String> = Vec::new();
            if let Some(extra_request_statements) = self
                .get_gen_option(ctx)
                .as_ref()
                .and_then(|opt| opt.extra_request_statements.as_ref())
            {
                extra_stmts.extend(extra_request_statements.iter().cloned());
            }


            for stmt in extra_stmts {
                result += &format!("        {};\n", stmt);
            }
        }

        // Call service method
        let service_method_name = method_name.to_case(Case::Camel);
        if method.res.is_some() {
            let response_ty = get_response_name(ctx, method_name);
            result += &format!("        {} response = {}.{}(", response_ty, service_field, service_method_name);
        } else {
            result += &format!("        {}.{}(", service_field, service_method_name);
        }

        if method.req.is_some() {
            result += "request";
        }
        result += ");\n";

        // Return response
        if method.res.is_some() {
            result += "        return response;\n";
        } 

        result += "    }\n";

        Ok(dto_result + &result)
    }

    fn gen_body_dto(
        &self,
        method_name: &str,
        schema: &RawSchema,
        props: &HashSet<String>,
    ) -> Result<(String, String)> {
         let dto_name = (method_name.to_owned() + "BodyDto").to_case(Case::UpperCamel);

        let mut result = String::new();
        let annotations = vec![
            "@Data", // Lombok annotation for getters/setters
            "@AllArgsConstructor", // Lombok annotation for all-args constructor
            "@NoArgsConstructor", // Lombok annotation for no-args constructor
        ];
        for annotation in annotations {
            result += &format!("{}\n", annotation);
        }
        result += &format!("public class {} {{\n", dto_name);
        for prop in props {
            if let Some(prop_schema) = schema.properties.as_ref().and_then(|props| props.get(prop)) {
                let java_type = self.get_java_type(prop_schema)?;
                let java_prop_name = prop.to_case(Case::Camel);
                result += &format!("    private {} {};\n", java_type, java_prop_name);
            } else {
                bail!("Property {} not found in schema", prop);
            }
        }
        result += "\n}\n";


        return Ok((dto_name, result));
    }

    fn get_java_type(&self, prop_schema: &RawSchema) -> Result<String> {
        if let Some(ty) = prop_schema.ty.as_ref() {
            if let Some(builtin_ty) = spec_ty_to_java_builtin_ty(ty) {
                Ok(builtin_ty)
            } else {
                Ok(ty.to_case(Case::UpperCamel))
            }
        } else if prop_schema.items.is_some() {
            let item_type = self.get_java_type(prop_schema.items.as_ref().unwrap())?;
            Ok(format!("List<{}>", item_type))
        } else {
            bail!("Cannot determine Java type for property")
        }
    }

    fn get_gen_option<'a>(&self, ctx: &'a Ctxt) -> Option<&'a JavaSpringWebGeneratorOption> {
        ctx.spec.option.as_ref().and_then(|go| {
            go.generator
                .as_ref()
                .and_then(|gen| gen.java_springweb.as_ref())
        })
    }

    fn dst_dir(&self, ctx: &Ctxt) -> String {
        let default_dir = ".";

        self.get_gen_option(ctx)
            .and_then(|gen| {
                Some(get_path_from_optional_parent(
                    gen.def_loc.file.parent(),
                    gen.dir.as_ref(),
                    default_dir,
                ))
            })
            .unwrap_or_else(|| default_dir.into())
    }
}

fn common_imports() -> String {
    let imports = vec![
        "org.springframework.web.bind.annotation.*",
        "org.springframework.beans.factory.annotation.Autowired",
        "lombok.Data",
        "lombok.NoArgsConstructor",
        "lombok.AllArgsConstructor",
        "java.util.List",
        "java.util.Map",
    ];
    imports
        .iter()
        .map(|import| format!("import {};", import))
        .collect::<Vec<String>>()
        .join("\n")
}