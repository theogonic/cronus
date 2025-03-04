use std::{collections::HashSet, path::{Path, PathBuf}};

use convert_case::{Casing, Case};
use cronus_spec::{RawSchema, RawUsecase, RawUsecaseMethod};

use crate::Ctxt;


pub fn spec_ty_to_rust_builtin_ty(spec_ty: &str) -> Option<String> {
    if spec_ty == "string" {
        return Some("String".to_string());
    }
    else if spec_ty == "integer" || spec_ty == "int" || spec_ty == "i32" {
        return Some("i32".to_string());
    }
    else if spec_ty == "u32" {
        return Some("u32".to_string());
    }
    else if spec_ty == "bool" || spec_ty == "boolean" {
        return Some("bool".to_string());
    }
    else if spec_ty.starts_with("map<") {
        let (left_ty, right_ty) = parse_map_type(spec_ty);
        let left = spec_ty_to_rust_builtin_ty(left_ty).unwrap_or(left_ty.to_case(Case::UpperCamel));
        let right = spec_ty_to_rust_builtin_ty(right_ty).unwrap_or(right_ty.to_case(Case::UpperCamel));
        return Some(format!("HashMap<{left},{right}>").to_string())
    }
    return None;
}

pub fn spec_ty_to_py_builtin_ty(spec_ty: &str) -> Option<String> {
    if spec_ty == "string" {
        return Some("str".to_string());
    }
    else if spec_ty == "integer" || spec_ty == "int" || spec_ty == "i32" {
        return Some("int".to_string());
    }
    else if spec_ty == "u32" {
        return Some("int".to_string());
    }
    else if spec_ty == "bool" || spec_ty == "boolean" {
        return Some("bool".to_string());
    }
    else if spec_ty.starts_with("map<") {
        let (left_ty, right_ty) = parse_map_type(spec_ty);
        let left = spec_ty_to_rust_builtin_ty(left_ty).unwrap_or(left_ty.to_case(Case::UpperCamel));
        let right = spec_ty_to_rust_builtin_ty(right_ty).unwrap_or(right_ty.to_case(Case::UpperCamel));
        return Some(format!("dict[{left},{right}]").to_string())
    }
    return None;
}

pub fn parse_map_type(map_ty: &str) -> (&str,&str) {
    let child_types:Vec<&str> = map_ty[4..map_ty.len()-1].split(",").collect();
    let left_ty = child_types.get(0).unwrap();
    let right_ty = child_types.get(1).unwrap();
    return (left_ty, right_ty)
}


/// valid openapi builtin types: "array", "boolean", "integer", "number", "object", "string"
pub fn spec_ty_to_openapi_builtin_ty(spec_ty: &str) -> Option<String> {
    let result = if spec_ty == "string" {
         Some("string".to_string())
    }
    else if spec_ty == "integer" || spec_ty == "int" || spec_ty == "i32" || spec_ty == "u32" {
         Some("integer".to_string())
    }
    else if spec_ty == "bool" || spec_ty == "boolean" {
         Some("boolean".to_string())
    } else {
        None
    };

    result
}

/// Extract variables from url path like /abcde/:var1/jdf/:var2 => [var1, var2]
pub fn extract_url_variables(url: &str) -> Vec<String> {
    let mut variables = Vec::new();
    for segment in url.split('/') {
        if segment.starts_with(':') {
            variables.push(segment[1..].to_string());
        }
    }
    variables
}

pub fn get_path_from_optional_parent(par: Option<&Path>, file:Option<&String>, default_file:&str) -> String {
    if par.is_none() {
        if let Some(file) = file {
            return file.into();
        }
        return default_file.into();
    }
    let rel_root = par.unwrap();
    if let Some(file) = file {
        if PathBuf::from(file).is_absolute() {
            return file.clone();
        }

        return rel_root.join(file).to_str().unwrap().to_string();

    }

    rel_root.join(default_file).to_str().unwrap().to_string()
}

pub fn get_schema_by_name<'ctx>(ctx: &'ctx Ctxt, ty_name: &str) -> Option<&'ctx RawSchema> {
    ctx.spec.ty.as_ref().and_then(|tys| tys.get(ty_name))
}

pub fn get_usecase_suffix(ctx: &Ctxt) -> String {
    let mut suffix = "Usecase".to_owned();
    if let Some(global_option) = &ctx.spec.option {
            if let Some(override_suffix) = &global_option.usecase_suffix {
                suffix = override_suffix.to_owned();
            }
        
    }

    return suffix;
}

pub fn get_usecase_name(ctx: &Ctxt, usecase_name:&str) -> String {
    return ( usecase_name.to_owned() + &get_usecase_suffix(ctx) ).to_case(Case::UpperCamel)
}


fn get_request_suffix(ctx: &Ctxt) -> String {
    let mut suffix = "Request".to_owned();
    if let Some(global_option) = &ctx.spec.option {
            if let Some(override_suffix) = &global_option.usecase_request_suffix {
                suffix = override_suffix.to_owned();
            }
        
    }

    return suffix;
}

fn get_response_suffix(ctx: &Ctxt) -> String {
    let mut suffix = "Response".to_owned();
    if let Some(global_option) = &ctx.spec.option {
            if let Some(override_suffix) = &global_option.usecase_response_suffix {
                suffix = override_suffix.to_owned();
            }
        
    }

    return suffix;
}

pub fn get_response_name(ctx: &Ctxt,  method_name:&str) ->String {
    return ( method_name.to_owned() + &get_response_suffix(ctx)).to_case(Case::UpperCamel)
}

pub fn get_request_name(ctx: &Ctxt,  method_name:&str) ->String {
    return  (method_name.to_owned() + &get_request_suffix(ctx)).to_case(Case::UpperCamel)
}

pub fn get_path_params(method: &RawUsecaseMethod) -> Option<HashSet<String>> {
    method.option.as_ref().and_then(|option| {
        option.rest.as_ref().and_then(|rest|{
            rest.path.as_ref().and_then(|path| {
                let vars = extract_url_variables(path);
                if vars.is_empty() {
                    None
                } else {
                    Some(vars.into_iter().collect())
                }

            })
        })
    })
}

pub fn get_usecase_rest_path_prefix(usecase: &RawUsecase) -> String {
    usecase.option.as_ref()
    .and_then(|opt| opt.rest.as_ref())
    .and_then(|rest_opt| rest_opt.path.as_ref())
    .map(|p| if p.starts_with('/') { p.clone() } else { format!("/{}", p) })
    .unwrap_or_else(|| "/".to_string())
}

pub fn get_query_params(method: &RawUsecaseMethod) -> Option<HashSet<String>> {
    method.req.as_ref().and_then(|req_schema| {
        req_schema.properties.as_ref()
        .and_then(|props| {
            let result: HashSet<String> = props.iter()
            .filter_map(|(name, schema)| {
                match schema.option.as_ref().and_then(|option| {
                    option.rest.as_ref().and_then(|rest| rest.query)
                }) {
                    Some(query) => Some(name.clone()),
                    None => None,
                }
            })
            .collect();
            if result.is_empty() {
                None
            } else {
                Some(result)
            }
        })

    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_variables() {
        let path = "/people/:name/id/:id";
        let expected = vec!["name".to_string(), "id".to_string()];
        assert_eq!(extract_url_variables(path), expected);
    }

    #[test]
    fn test_no_variables() {
        let path = "/people/name/id";
        let expected: Vec<String> = vec![];
        assert_eq!(extract_url_variables(path), expected);
    }

    #[test]
    fn test_multiple_variables() {
        let path = "/people/:name/:surname/id/:id";
        let expected = vec!["name".to_string(), "surname".to_string(), "id".to_string()];
        assert_eq!(extract_url_variables(path), expected);
    }

    #[test]
    fn test_empty_path() {
        let path = "";
        let expected: Vec<String> = vec![];
        assert_eq!(extract_url_variables(path), expected);
    }

    #[test]
    fn test_single_variable() {
        let path = "/:variable";
        let expected = vec!["variable".to_string()];
        assert_eq!(extract_url_variables(path), expected);
    }
}