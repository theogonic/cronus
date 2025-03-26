use core::panic;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::bail;
use anyhow::Result;
use cronus_spec::RawSchemaEnumItem;
use serde::de::DeserializeOwned;
use cronus_spec::DefLoc;
use cronus_spec::GlobalOption;
use crate::api_parser::Rule;
use pest::iterators::Pair;
use pest::Parser;
use cronus_spec::RawSchema;
use cronus_spec::RawSchemaPropertyOption;
use cronus_spec::RawSpec;
use cronus_spec::RawUsecase;
use cronus_spec::RawUsecaseMethod;


fn parse_file(def_loc:Arc<DefLoc>, pairs: Pair<Rule>) -> Result<RawSpec> {
    let mut spec = RawSpec::new();

    let mut options: Vec<(Vec<String>, serde_yaml::Value)> = Default::default();
    
    for pair in pairs.into_inner() {
        let (line, col) = pair.line_col();
        match pair.as_rule() {
            Rule::struct_def => {
                let (name, schema) = parse_struct_def(def_loc.clone(), pair)?;
                if let Some(n) = name {
                    match spec.ty {
                        Some(ref mut tys) => {
                            tys.insert(n, schema);
                        },
                        None => {
                            let mut tys = HashMap::new();
                            tys.insert(n, schema);
                            spec.ty = Some(tys);
                        },
                    }
                } else {
                    bail!("expect to have name of the schema in the top level at {}:{}", line, col)
                }
            }
            Rule::enum_def => {
                let (name, schema) = parse_enum_def(def_loc.clone(), pair)?;
                if let Some(n) = name {
                    match spec.ty {
                        Some(ref mut tys) => {
                            tys.insert(n, schema);
                        },
                        None => {
                            let mut tys = HashMap::new();
                            tys.insert(n, schema);
                            spec.ty = Some(tys);
                        },
                    }
                } else {
                    bail!("expect to have name of the enum in the top level at {}:{}", line, col)
                }
            }
            Rule::usecase => {
                let (name, usecase) = parse_usecase(def_loc.clone(), pair)?;
                match spec.usecases {
                    Some(ref mut usecases) => {
                        usecases.insert(name, usecase);
                    },
                    None => {
                        let mut usecases = HashMap::new();
                        usecases.insert(name, usecase);
                        spec.usecases = Some(usecases);
                    },
                }
            }
            Rule::global_option => {
                for inner_pair in pair.into_inner() {
                    match inner_pair.as_rule() {
                        Rule::option => {
                            let option = parse_option(def_loc.clone(), inner_pair)?;
                            options.push(option);
                        }
                        _ => {}
                    }
                }
            }
            Rule::import => {
                let import = parse_import( pair);
                match spec.imports {
                    Some(ref mut imp) => {
                        imp.push(import);
                    },
                    None => {
                        spec.imports = Some(vec![import])
                    },
                }
            },
            _ => {}
        }
    }

    // insert options to global option
    let mut option_mapping = serde_yaml::Mapping::new();
    for (keys, value) in options {
        insert_value_by_keys(&mut option_mapping, keys, value)?;
    }

    spec.option = yaml_mapping_to_option(option_mapping);
    set_def_loc_for_global_option(def_loc.clone(), spec.option.as_mut());

    Ok(spec)
}

fn set_def_loc_for_global_option(def_loc:Arc<DefLoc>,  global_option: Option<&mut GlobalOption>) {
    match global_option {
        Some(go) => {
            match &mut go.generator {
                Some(g) => {
                    match &mut g.rust {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                    match &mut g.python {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                    match &mut g.python_fastapi {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }

                    match &mut g.rust_axum {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                    match &mut g.openapi {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                    match &mut g.typescript {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                    match &mut g.typescript_nestjs {
                        Some(r) => r.def_loc = def_loc.clone(),
                        None => {},
                    }
                },
                None => {},
            }
        }
        None => {},
    }
}

fn parse_import(pair: pest::iterators::Pair<Rule>) -> String {
    let mut path = String::new();

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::path => {
                path = inner_pair.as_str().to_string();
                break; // Path is the only expected content after 'import'
            },
            _ => {}
        }
    }

    path
}

fn parse_struct_def(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(Option<String>, RawSchema)> {
    let mut name = None;
    let mut options = None; 
    let mut schema = RawSchema {
        def_loc: def_loc.clone(),
        ty: None,
        properties: None,
        items: None,
        required:None,
        namespace: None,
        enum_items:None,
        option: None,
        extends:None,
        flat_extends: None,
    };
    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => name = Some(inner_pair.as_str().to_string()),
            Rule::option => {
                options = Some(parse_option(def_loc.clone(), inner_pair));
            },
            Rule::struct_body => {
                let properties = parse_struct_body(def_loc.clone(), inner_pair)?;
                schema.properties = Some(properties)
            },
            _ => {
                panic!("missing rule handling")
            }
        }
    }

    Ok((name, schema))
}

fn parse_enum_def(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(Option<String>, RawSchema)> {
    let mut name = None;
    let mut enum_items = Vec::new();
    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => name = Some(inner_pair.as_str().to_string()),
            Rule::enum_body => {
                enum_items = parse_enum_body(def_loc.clone(), inner_pair)?;
            },
            _ => {
                panic!("missing rule handling")
            }
        }
    }

    let schema = RawSchema {
        def_loc,
        ty: None,
        properties: None,
        items: None,
        required: None,
        namespace: None,
        enum_items: Some(enum_items),
        option: None,
        extends: None,
        flat_extends: None,
    };

    Ok((name, schema))
}

fn parse_enum_body(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<Vec<RawSchemaEnumItem>> {
    let mut enum_items: Vec<RawSchemaEnumItem> = Vec::new();

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::enum_property => {
                // Parse each enum property and add it to the enum_items vector
                let enum_item = parse_enum_property(def_loc.clone(), inner_pair)?;
                enum_items.push(enum_item);
            },
            _ => {
                bail!("unexpected rule found in enum body: {:?}", inner_pair.as_rule())
            }
        }
        
    }

    Ok(enum_items)
}

fn parse_enum_property(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<RawSchemaEnumItem> {
    let mut name = String::new();
    let mut enum_value: Option<i32> = None;
    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => {
                name = inner_pair.as_str().to_string();
            },
            Rule::option => {
                let (keys, value) = parse_option(def_loc.clone(), inner_pair.clone())?;
                if keys.len() == 1 && keys[0] == "value" {
                    // If the option is "value", we can set the value of the enum item
                    if let serde_yaml::Value::Number(num) = value {
                        if let Some(v) = num.as_i64() {
                            enum_value = Some(v as i32); // Convert to i32
                        } else {
                            bail!("value must be an integer for enum item: {:?}", inner_pair.as_str());
                        }
                    }
                }
            },
            _ => {
                bail!("unexpected rule found in enum property: {:?}", inner_pair.as_rule())
            }
        }
    }


    Ok(RawSchemaEnumItem { name: name, value: enum_value })
}

fn parse_struct_body(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<HashMap<String, RawSchema>> {
    let mut properties = HashMap::new();

    for inner_pair in pair.into_inner() {
        if inner_pair.as_rule() == Rule::property {
            let (prop_name, prop_schema) = parse_property(def_loc.clone(), inner_pair)?;
            properties.insert(prop_name, prop_schema);
        }
    }

    Ok(properties)
}

fn parse_option(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(Vec<String>, serde_yaml::Value)> {
    let mut keys = Vec::new();
    let mut value = serde_yaml::Value::Null;

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::option_identifier => {
                // Split the identifier by '.' and extend the keys vector
                let mut items:Vec<String> = inner_pair.as_str().split('.').map(String::from).collect();
                if items[0].starts_with("@") {
                    // @ is the shortcut for generator
                    items[0].remove(0);
                    items.insert(0, "generator".to_owned());
                }

                keys.extend(items);
            },
            Rule::option_value => {
                for value_pair in inner_pair.into_inner() {
                    value = parse_option_value(value_pair);
                    break;
                }
            },
            _ => {
               unreachable!()
            }
            // todo
        }
    }

    // means it is implicitly boolean
    if value == serde_yaml::Value::Null {
        value = serde_yaml::Value::Bool(true);
    }

    Ok((keys, value))
}

fn parse_option_value(pair: pest::iterators::Pair<Rule>) -> serde_yaml::Value {
    match pair.as_rule() {
        Rule::integer => parse_integer(pair),
        Rule::string => parse_string(pair),
        Rule::bool => parse_bool(pair),
        Rule::array => parse_array(pair),
        Rule::option_value => parse_option_value(pair.into_inner().next().unwrap()),
        _ => {
            println!("Unexpected token: {:?}", pair);
            unreachable!()
        }, // We should not reach here as per the grammar
    }
}

fn parse_integer(pair: pest::iterators::Pair<Rule>) -> serde_yaml::Value {
    // Parse the integer string into i64
    let int_value = pair.as_str().parse::<i64>().unwrap(); // Handle errors appropriately
    serde_yaml::Value::from(int_value)
}


fn parse_string(pair: pest::iterators::Pair<Rule>) -> serde_yaml::Value {
    serde_yaml::Value::String(pair.as_str().trim_matches('"').to_string())
}

fn parse_bool(pair: pest::iterators::Pair<Rule>) -> serde_yaml::Value {
    serde_yaml::Value::Bool(pair.as_str().parse().unwrap())
}

fn parse_array(pair: pest::iterators::Pair<Rule>) -> serde_yaml::Value {
    let values = pair.into_inner().map(parse_option_value).collect::<Vec<_>>();
    serde_yaml::Value::Sequence(values)
}

fn insert_value_by_keys(mapping: &mut serde_yaml::Mapping, keys: Vec<String>, value: serde_yaml::Value) -> Result<()> {
    if keys.is_empty() {
        bail!("keys is empty");
    }

    let mut current_map = mapping;

    // Iterate over all keys except the last one
    for key in keys[..keys.len() - 1].iter() {
        // Convert the current key to a `Value`
        let yaml_key = serde_yaml::Value::String(key.clone());

        // If the key doesn't exist in the current map, insert a new empty map
        if !current_map.contains_key(&yaml_key) {
            current_map.insert(yaml_key.clone(), serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
        }

        // Move to the next level in the map
        if let Some(serde_yaml::Value::Mapping(next_map)) = current_map.get_mut(&yaml_key) {
            current_map = next_map;
        } else {
            // The current path is not a map, can't insert
            bail!("The current path {:?} is not a map, can't insert '{:?}'", keys, value)
        }
    }

    // Insert the value at the last key
    let last_key = serde_yaml::Value::String(keys[keys.len() - 1].clone());
    current_map.insert(last_key, value);
    Ok(())
}

fn parse_property(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(String, RawSchema)> {
    let mut name = String::new();
    let mut type_name = String::new();
    let mut options = serde_yaml::Mapping::new();
    let mut required = true;
    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => {
                name = inner_pair.as_str().to_string();
            },
            Rule::type_identifier => {
                type_name = inner_pair.as_str().to_string();
            },
            Rule::option => {
                let (keys, value) = parse_option(def_loc.clone(), inner_pair)?;
                insert_value_by_keys(&mut options, keys, value)?;
            },
            Rule::optional_property => {
                required = false;
            }
            _ => {}
        }
    }  

    let mut items = None;
    let is_array = type_name.ends_with("[]");
    // check if type is array
    if is_array {
        let mut items_ty = type_name.clone();
        items_ty.truncate(type_name.len() - 2);
        items = Some(Box::new(RawSchema::new(def_loc.clone(), items_ty)));
    }

    
    let op:Option<RawSchemaPropertyOption> = yaml_mapping_to_option(options);

    let schema = RawSchema {
        def_loc,
        ty: if is_array { None } else { Some(type_name) },
        items,
        properties: None,
        required: Some(required),
        namespace: None,
        enum_items: None,
        option: op,
        extends: None,
        flat_extends: None,
        
    };

    Ok((name, schema))
}


pub fn parse(file_path: PathBuf, file_content: &str) -> Result<RawSpec> {
    let mut pairs = crate::api_parser::APIParser::parse(Rule::file, file_content)?;
    let def_loc = Arc::new(DefLoc::new(file_path));
    match pairs.next() {
        Some(pair) => {
            // One api file content only has one Rule::file
            let file = parse_file(def_loc.clone(), pair)?;
            Ok(file)
        }
        None => bail!("empty file found"),
    }
}

fn parse_usecase(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(String, RawUsecase)> {
    let mut methods = HashMap::new();
    let mut usecase_name = String::new();
    let mut options = serde_yaml::Mapping::new();

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => {
                usecase_name = inner_pair.as_str().to_string();
            },
            Rule::option => {
                let (keys, value) = parse_option(def_loc.clone(), inner_pair)?;
                insert_value_by_keys(&mut options, keys, value)?;
            },
            Rule::method_def => {
                let (method_name, method) = parse_method_def(def_loc.clone(), inner_pair)?;
                methods.insert(method_name, method);
            },
            _ => {}
        }
    }

    Ok((usecase_name, RawUsecase {
        def_loc,
        methods,
        option: if options.is_empty() { None } else { serde_yaml::from_value(serde_yaml::Value::Mapping(options)).unwrap() },
    }))
}

fn parse_block(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<RawSchema> {

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::struct_body => {
                let properties = parse_struct_body(def_loc.clone(), inner_pair)?;

                return Ok(RawSchema {
                    def_loc,
                    properties: Some(properties),
                    ty: None,
                    items: None,
                    required: None,
                    namespace: None,
                    enum_items: None,
                    option: None,
                    extends: None,
                    flat_extends: None,
                })
            },
            _ => {
                unreachable!()
            }
        }
    }

    unreachable!()
    
}

fn yaml_mapping_to_option< T: DeserializeOwned>(m: serde_yaml::Mapping) -> Option<T> {
    if m.is_empty() { None } else { serde_yaml::from_value(serde_yaml::Value::Mapping(m)).unwrap() }
}

fn parse_method_def(def_loc:Arc<DefLoc>, pair: pest::iterators::Pair<Rule>) -> Result<(String, RawUsecaseMethod)> {
    let mut method_name = String::new();
    let mut req = None;
    let mut res = None;
    let mut options = serde_yaml::Mapping::new();

    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::identifier => {
                method_name = inner_pair.as_str().to_string();
            },
            Rule::option => {
                let (keys, value) = parse_option(def_loc.clone(), inner_pair)?;
                insert_value_by_keys(&mut options, keys, value)?;
            },
            Rule::in_block => {
                req = Some(parse_block(def_loc.clone(), inner_pair)?);
            },
            Rule::out_block => {
                res = Some(parse_block(def_loc.clone(), inner_pair)?);
            },
            _ => {}
        }
    }

    let method = RawUsecaseMethod {
        req,
        res,
        option: yaml_mapping_to_option(options)
    };

    Ok((method_name, method))
}

#[cfg(test)]
mod tests {
    use std::error::Error;


    use crate::*;

    #[test]
    fn can_parse_import() -> Result<()> {
        let api_file: &'static str = r#"
import abc.api
import def.api
        "#;

        let res = api_parse::parse(PathBuf::from(""),api_file)?;

        assert!(res.imports.is_some());
        assert!(res.imports.as_ref().unwrap().len() == 2);
        assert!(res.imports.as_ref().unwrap().contains(&"abc.api".to_owned()));
        assert!(res.imports.as_ref().unwrap().contains(&"def.api".to_owned()));

        Ok(())
    }

    #[test]
    fn can_parse_usecase() -> Result<()> {
        let api_file: &'static str = r#"
usecase abc {
    create_abc {}
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

        let res = api_parse::parse(PathBuf::from(""), api_file)?;

        assert!(res.usecases.is_some());
        assert!(res.usecases.as_ref().unwrap().len() == 1);
        let usecase = res.usecases.as_ref().unwrap().get("abc").unwrap();
        assert!( usecase.methods.len() == 2);
        let method_abc = usecase.methods.get("create_abc").unwrap();
        assert!(method_abc.req.is_none());
        assert!(method_abc.res.is_none());
        println!("{:?}", method_abc.option);
    
        assert!(method_abc.option.is_none());

        let method_abcd = usecase.methods.get("create_abcd").unwrap();
        assert!(method_abcd.req.is_some());
        assert!(method_abcd.res.is_some());
        let req = method_abcd.req.as_ref().unwrap();
        let req_a = req.properties.as_ref().unwrap().get("a").unwrap();
        assert_eq!(req_a.ty.as_ref().unwrap(), &"string".to_string());
        assert!(method_abcd.option.is_none());

        Ok(())
    }


    #[test]
    fn can_parse_struct() -> Result<()> {
        let api_file: &'static str = r#"
struct abc {
    a: string
    b: int
    c?: u32
}
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;

        let tys = spec.ty.unwrap();
        assert!(tys.len() == 1);
        let properties = tys.get("abc").as_ref().unwrap().properties.as_ref().unwrap();
        assert_eq!(properties.len(), 3);
        assert_eq!(properties.get("a").as_ref().unwrap().ty, Some("string".to_string()));
        assert_eq!(properties.get("b").as_ref().unwrap().ty, Some("int".to_string()));
        assert_eq!(properties.get("c").as_ref().unwrap().ty, Some("u32".to_string()));
        assert!(!properties.get("c").as_ref().unwrap().required.unwrap());
        assert!(properties.get("b").as_ref().unwrap().required.unwrap());



        Ok(())

    }

    #[test]
    #[should_panic(expected = "unknown field")]
    fn cannot_parse_undefined_option()  {
        let api_file: &'static str = r#"
# [generator.rest]
        "#;

        let _ = api_parse::parse(PathBuf::from(""), api_file);

    }


    #[test]
    fn can_parse_global_option() -> Result<()>  {
        let api_file: &'static str = r#"
# [generator.rust.file = "abcde"]
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        assert!(spec.option.as_ref().unwrap().generator.is_some());
        let rust_config = spec.option.as_ref().unwrap().generator.as_ref().unwrap().rust.as_ref().unwrap();
        assert_eq!(rust_config.file.as_ref().unwrap(), &"abcde".to_string());

        Ok(())
    }

    #[test]
    fn can_parse_global_option_with_generator_shortcut() -> Result<()>  {
        let api_file: &'static str = r#"
# [@rust.file = "abcde"]
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        assert!(spec.option.as_ref().unwrap().generator.is_some());
        let rust_config = spec.option.as_ref().unwrap().generator.as_ref().unwrap().rust.as_ref().unwrap();
        assert_eq!(rust_config.file.as_ref().unwrap(), &"abcde".to_string());

        Ok(())
    }

    #[test]
    fn can_parse_global_option_with_implicit_bool() -> Result<()>  {
        let api_file: &'static str = r#"
# [generator.rust.async]
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;
        assert!(spec.option.as_ref().unwrap().generator.is_some());
        let rust_config = spec.option.as_ref().unwrap().generator.as_ref().unwrap().rust.as_ref().unwrap();
        assert_eq!(rust_config.async_flag, Some(true));

        Ok(())
    }

    #[test]
    fn can_parse_enum() -> Result<()> {
        let api_file: &'static str = r#"
        enum abc {
            a
            b
            c
            }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;

        let tys = spec.ty.unwrap();
        assert!(tys.len() == 1);
        let enum_items = tys.get("abc").as_ref().unwrap().enum_items.as_ref().unwrap();
        assert_eq!(enum_items.len(), 3);
        assert_eq!(enum_items[0].name, "a");
        assert_eq!(enum_items[1].name, "b");
        assert_eq!(enum_items[2].name, "c");

        Ok(())
    }

    #[test]
    fn can_parse_enum_with_value() -> Result<()> {
        let api_file: &'static str = r#"
        enum abc {
            [value = 1] 
            a
            b
            c
            }
        "#;

        let spec = api_parse::parse(PathBuf::from(""), api_file)?;

        let tys = spec.ty.unwrap();
        assert!(tys.len() == 1);
        let enum_items = tys.get("abc").as_ref().unwrap().enum_items.as_ref().unwrap();
        assert_eq!(enum_items.len(), 3);
        assert_eq!(enum_items[0].name, "a");
        assert_eq!(enum_items[0].value, Some(1));
        assert_eq!(enum_items[1].name, "b");
        assert_eq!(enum_items[2].name, "c");

        Ok(())
    }

    #[test]
    fn can_parse_usecase_option() -> Result<()>  {
        let api_file: &'static str = r#"
        # [generator.rust.file = "abcde"]
        
        [rest.path = "/abdf/def"]
        usecase abc {
            create_abc {}
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
        let usecase = spec.usecases.as_ref().unwrap().get("abc").unwrap();
        let option = usecase.option.as_ref().unwrap();
        assert_eq!(option.rest.as_ref().unwrap().path.as_ref().unwrap(), &"/abdf/def".to_string());

        let global_option = spec.option.as_ref().unwrap().generator.as_ref().unwrap();
        assert_eq!(global_option.rust.as_ref().unwrap().file.as_ref().unwrap(), &"abcde".to_string());
        Ok(())
    }



}
