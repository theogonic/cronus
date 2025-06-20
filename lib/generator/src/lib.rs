mod rust;
mod rust_axum;
mod openapi;
mod openapi_utils;
mod utils;
mod ts;
mod ts_nestjs;
mod python;
mod rust_utils;
mod python_fastapi;
mod python_redis;
mod golang;
mod golang_gin;

use std::{rc::Rc, cell::{RefCell}, collections::{HashMap, HashSet}, path::{Path, PathBuf}, error::Error, fs::{self, OpenOptions, File}, io::Write};

use openapi::OpenAPIGenerator;
use rust::RustGenerator;
use rust_axum::RustAxumGenerator;
use cronus_spec::{RawSchema, RawSpec, RawUsecase, RawUsecaseMethod};
use tracing::info;
use ts::TypescriptGenerator;
use ts_nestjs::TypescriptNestjsGenerator;
use anyhow::{bail, Context as _, Ok, Result};

/// relative path => file content
type GeneratorFileSystem = Rc<RefCell<HashMap<String, String>>>;

pub struct Context {
    pub generator_fs: RefCell<HashMap<&'static str, GeneratorFileSystem>>,
    pub spec: RawSpec,
}

impl Context {
    pub fn new(spec: RawSpec) -> Self {
        Self {
            generator_fs: RefCell::new(HashMap::new()),
            spec,
        }
    }

    pub fn get_gfs(&self, name: &'static str) -> GeneratorFileSystem {
        if self.generator_fs.borrow().contains_key(name) {
            self.generator_fs.borrow().get(name).unwrap().clone()
        } else {
            self.init_gfs(name)
        }
    }

    fn init_gfs(&self, name: &'static str) -> GeneratorFileSystem {
        let fs = Rc::new(RefCell::new(HashMap::new()));
        self.generator_fs.borrow_mut().insert(name, fs.clone());
        fs
    }

    pub fn append_file(&self, name:&'static str, path:&str, content: &str) {
        let fs = self.get_gfs(name);
        let mut mutated_fs = fs.borrow_mut();
        match mutated_fs.get_mut(path) {
            Some(f) => {
                f.push_str(&content);
            },
            None => {
                mutated_fs.insert(path.to_string(), content.to_string());
            },
        };

    }

    

    /// Write the results/files of the generator to the disk
    /// 
    /// 
    pub fn dump(&self) -> Result<()> {
        let mut touched_files: HashSet<String> = Default::default();

        for (g, fs) in self.generator_fs.borrow().iter() {
            for (path, contents) in fs.borrow().iter() {
                let pb = PathBuf::from(path);
                let par = pb.parent().unwrap();
                if !par.exists() {
                    std::fs::create_dir_all(par)?;
                }
                let mut file: File;
                if touched_files.contains(path) {
                    file = OpenOptions::new()
                    .write(true)
                    .append(true)
                    .create(true)
                    .open(path).context(format!("failed to open {}", path))?;
                } else {
                    file = OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .open(path).context(format!("failed to open {}", path))?;
                    touched_files.insert(path.to_string());
                }
                
                file.write_all(contents.as_bytes())?;
                info!("[+] {}", path);
      
            }
        }
        Ok(())
    }

}


#[derive(Clone)]
pub struct Ctxt(std::sync::Arc<Context>);

impl std::ops::Deref for Ctxt {
    type Target = Context;

    fn deref(&self) -> &Self::Target {
        self.0.as_ref()
    }
}

impl Ctxt {
    pub fn new(spec: RawSpec) -> Self {
        Self(std::sync::Arc::new( Context::new(spec)))
    }
}

pub trait Generator {
    fn name(&self) -> &'static str;
    fn before_all(&self, _ctx: &Ctxt) -> Result<()> {
        Ok(())
    }
    fn after_all(&self, _ctx: &Ctxt) -> Result<()> {
        Ok(())
    }
    fn generate_schema(&self, _ctx: &Ctxt, _schema_name:&str, _schema: &RawSchema)-> Result<()> {
        Ok(())
    }
    fn generate_usecase(&self, _ctx: &Ctxt, _usecase_name: &str, _usecase: &RawUsecase) -> Result<()> {
        Ok(())
    }
}

pub fn generate(ctx: &Ctxt) -> Result<()> {
    let generators:Vec<Rc<dyn Generator>> = vec![
        Rc::new(RustGenerator::new()),
        Rc::new(RustAxumGenerator::new()),
        Rc::new(OpenAPIGenerator::new()),
        Rc::new(TypescriptGenerator::new()),
        Rc::new(TypescriptNestjsGenerator::new()),
        Rc::new(python::PythonGenerator::new()),
        Rc::new(python_fastapi::PythonFastApiGenerator::new()),
        Rc::new(python_redis::PythonRedisGenerator::new()),
        Rc::new(golang::GolangGenerator::new()),
        Rc::new(golang_gin::GolangGinGenerator::new()),
    ];
    let mut generator_map: HashMap<&str, Rc<dyn Generator>> = HashMap::new();
    generators
    .iter()
    .for_each(|g| {
        generator_map.insert(g.name(), g.clone());
    });


    if ctx.spec.option.is_none() {
        info!("No generator(s) is configured.");
    } else {
        if let Some(generator) = &ctx.spec.option.as_ref().unwrap().generator {

            let json_value = serde_yaml::to_value(generator).expect("Failed to serialize");
    
            if let serde_yaml::Value::Mapping(map) = &json_value {
                for (generator_name, config) in map {
                    if config.is_null(){
                        continue;
                    }
                    match generator_map.get(generator_name.as_str().unwrap()) {
                        Some(g) => {
                            run_generator(g.as_ref(), ctx)?;
                        },
                        None => {
                            bail!("Cannot find generator '{}'", generator_name.as_str().unwrap())
                        },
                    }
                   
                }
            }
    
        } else {
            info!("No generator(s) is configured.");
        }
    }
    Ok(())

}

pub fn run_generator(g: &dyn Generator, ctx: &Ctxt) -> Result<()> {
    g.before_all(ctx)?;
    let schema_items = ctx.spec
            .ty
            .iter()
            .flat_map(|t| t.iter());

    for (name, schema) in schema_items {
        g.generate_schema(ctx, name,schema)?
    }

    
    let usecase_items = ctx.spec
    .usecases
    .iter()
    .flat_map(|m| m.iter());

    for (name, usecase) in usecase_items {
        g.generate_usecase(ctx, name, usecase)?
    }


    g.after_all(ctx)

}


#[cfg(test)]
mod test {
    use std::{collections::HashSet, path::{Path, PathBuf}, process::Command};

    use cronus_spec::RawSpec;
    use anyhow::{bail, Result};
    use crate::{generate, Context, Ctxt};


    #[test]
    fn context_get_files_by_generator(){
        let ctx = Context::new(RawSpec::new());
        ctx.init_gfs("abcde");
        ctx.get_gfs("abcde");
    }

    #[test]
    fn context_append_file(){
        let ctx = Context::new( RawSpec::new());
        ctx.init_gfs("agenerator");

        ctx.append_file("agenerator", "src/lib.rs", "hello");
    }

    fn get_cargo_manifest_dir() -> Option<PathBuf> {
        std::env::var("CARGO_MANIFEST_DIR").ok().map(PathBuf::from)
    }

    #[test]
    fn e2e_hello_rust() -> Result<()> {
        let proj_dir = get_cargo_manifest_dir().unwrap().join("testdata").join("hello").join("rust");
        let spec_file = proj_dir.join("main.api");
        let mut explored = HashSet::new();  
        let spec = cronus_parser::from_file(&spec_file, true, None, &mut explored)?;
        let ctx = Ctxt::new(spec);
        generate(&ctx)?;
        run_cargo_check(&proj_dir)
    }

    #[test]
    fn e2e_hello_rust_axum() -> Result<()> {
        let proj_dir = get_cargo_manifest_dir().unwrap().join("testdata").join("hello").join("rust_axum");
        let spec_file = proj_dir.join("main.api");
        let mut explored = HashSet::new();  
        let spec = cronus_parser::from_file(&spec_file, true, None, &mut explored)?;
        let ctx = Ctxt::new(spec);
        generate(&ctx)?;
        run_cargo_check(&proj_dir)
    }

    fn run_cargo_check(dir: &Path) -> Result<()> {
        let output = Command::new("cargo")
            .arg("check")
            .current_dir(dir)
            .output()?;

        if !output.status.success() {
            bail!("Stdout: {}\nStderr: {}", String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr))
        }

        Ok(())
    }
}