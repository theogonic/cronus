
use std::{path::{Path, PathBuf}, error::Error, collections::{VecDeque, HashSet}, fs, fmt::format};
use anyhow::{bail, Result};
use cronus_spec::RawSpec;

pub mod api_parse;
pub mod api_parser;

pub fn from_yaml(file: &Path) -> Result<RawSpec> {
    let contents = fs::read_to_string(file)?;
    from_yaml_str(&contents)
}

pub fn from_api(file: &Path) -> Result<RawSpec> {
    let contents = fs::read_to_string(file)?;
    api_parse::parse(PathBuf::from(file), &contents)
}

#[tracing::instrument]
pub fn from_file(file: &Path, resolve_import: bool, search_paths: Option<&Vec<PathBuf>>) -> Result<RawSpec> {
    match file.extension() {
        Some(ext) => {
            match ext.to_str() {
                Some(ext_str) => {
                    let mut spec: RawSpec;
                    if ext_str.ends_with("yaml") || ext_str.ends_with("yml") {
                        spec = from_yaml(file)?;
                    } 
                    else if ext_str.ends_with("api")  {
                        spec = from_api(file)?;
                    } else {
                        bail!("unsupported file extension '{:?}', expect .yaml, .yml or .api", ext)
                    }
                    
                    if resolve_import {
                        let mut explored: HashSet<String> = Default::default();
                        resolve_imports(&mut spec, &mut explored, file.parent().unwrap(), search_paths)?;
                    }
                    
                    Ok(spec)
                },
                None => bail!("unsupported file extension '{:?}', expect .yaml, .yml or .api", ext),
            }
            
        },
        None => bail!("no file extension, expect .yaml, .yml or .api"),
    }
    
}

pub fn from_yaml_str(str: &str) -> Result<RawSpec> {
    let spec: RawSpec = serde_yaml::from_str(&str)?;
    Ok(spec)
}

pub fn to_yaml_str(spec: &RawSpec) -> Result<String> {
    let yaml = serde_yaml::to_string(spec)?;
    Ok(yaml)
}

pub fn resolve_imports(spec: &mut RawSpec, explored: &mut HashSet<String>, spec_parent:&Path, search_paths: Option<&Vec<PathBuf>>) -> Result<()> {

    for import in spec.imports.clone().into_iter().flatten() {
        if explored.contains(&import) {
            continue
        }
        explored.insert(import.clone());
        let import_path = get_import_path(&import, spec_parent,search_paths)?;
        let imported_spec = from_file(&import_path, true, search_paths)?;

        spec.merge(imported_spec)?
    }

    Ok(())
}

#[tracing::instrument]
fn get_import_path(import: &str, default_path:&Path, available_paths: Option<&Vec<PathBuf>>) -> Result<PathBuf> {
    let cleaned = import.replace("\r", "");
    let defualt_relative =  default_path.join(&cleaned);
    if defualt_relative.exists() {
        return Ok(defualt_relative)
    }

    if let Some(paths) = available_paths {
        for p in paths {
            let candidate = p.join(&cleaned);
            if candidate.exists() {
                return Ok(candidate)
            }
        }
    }

    bail!("no available file found for import '{}'", cleaned)
}