use convert_case::{Casing, Case};
use spec::RawSchema;

use crate::Ctxt;


pub fn spec_ty_to_rust_builtin_ty(spec_ty: &String) -> Option<String> {
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
    return None;
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