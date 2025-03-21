use clap::Parser;
use cronus_generator::{Ctxt, generate};
use tracing::{Level, span, debug};
use anyhow::Result;
use tracing_subscriber::{util::SubscriberInitExt, fmt::format::FmtSpan};
use std::{collections::HashMap, error::Error, fs::metadata, io::Read, path::{Path, PathBuf}};


#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[command(subcommand)]
    command: Option<Commands>,   
}

#[derive(Parser, Debug)]
enum Commands {
    /// Generate from a yaml file
    Gen {
        /// Input file path
        #[arg(short, long, value_parser)]
        input: Option<String>,
        /// Output to stdout
        #[arg(short, long, default_value_t = false)]
        stdout: bool,
    },
    /// Convert api to yaml
    Yaml {
        /// Input file path
        #[arg(short, long, value_parser)]
        input: Option<String>,

        /// Output to stdout
        #[arg(short, long, default_value_t = false)]
        stdout: bool,
    },
    /// Convert yaml to api
    Api {
        /// Input file path
        #[arg(short, long, value_parser)]
        input: Option<String>,

        /// Output to stdout
        #[arg(short, long, default_value_t = false)]
        stdout: bool,
    },
}



fn main() -> Result<(), Box<dyn Error>> {
    // tracing_subscriber::FmtSubscriber::builder()
    // .with_level(true)
    // .with_max_level(Level::TRACE)
    // .with_span_events(FmtSpan::CLOSE)
    // .init();

    let args = Args::parse();
    match args.command {
        Some(Commands::Gen { input, stdout }) => {
            match input {
                Some(i) => {
                    let target_path = PathBuf::from(i);
                    match metadata(&target_path) {
                        Ok(md) => {
                            if md.is_dir() {
                                let default_files = vec![PathBuf::from("main.yaml"), PathBuf::from("main.api")];
                                for default_file in &default_files {
                                    let try_file = Path::join(&target_path, default_file);
                                    if try_file.exists() {
                                        run(&try_file, None)?;
                                        break;
                                    }
                                }
                                    
                            } else if md.is_file() {
                                run(&target_path, None)?;
                            } else {
                                return Err(format!("Unsupported path: {:?}", md).into())
                            }
                        },
                        Err(err) => {
                            return Err(format!("Error to open the path '{:?}': {:?}", target_path, err).into())
                        },
                    };
                },
                None => {
                    let stdin_content = read_from_stdin();
                    let output = generate_from_api(&stdin_content)?;
                    if stdout {
                        print!("{}", output);
                    }
                }
            }
            
        },
        Some(Commands::Yaml { input, stdout }) => {
            match input {
                Some(i) => {
                    let target_path = PathBuf::from(i);
                    match metadata(&target_path) {
                        Ok(md) => {
                            if md.is_file() {
                                let content = std::fs::read_to_string(&target_path)?;
                                let output = api_to_yaml(&content)?;
                                if stdout {
                                    print!("{}", output);
                                }
                            } else {
                                return Err(format!("Unsupported path: {:?}", md).into())
                            }
                        },
                        Err(err) => {
                            return Err(format!("Error to open the path '{:?}': {:?}", target_path, err).into())
                        },
                    };
                },
                None => {
                    let stdin_content = read_from_stdin();
                    let output = api_to_yaml(&stdin_content)?;
                    if stdout {
                        print!("{}", output);
                    }
                }
            }

        },
        Some(Commands::Api { input, stdout }) => {
            // TODO
            
        },
        None => {
            return Err("No command provided".into());
        }
    }
    

    Ok(())
    
}

fn read_from_stdin() -> String {
    let mut buffer = String::new();
    let stdin = std::io::stdin();
    let mut handle = stdin.lock();

    handle.read_to_string(&mut buffer).expect("Failed to read from stdin");
    buffer
}

#[tracing::instrument]
pub fn run(entry_file: &Path, search_paths: Option<&Vec<PathBuf>>) -> Result<()> {
    let abs_file = std::path::absolute(entry_file)?;
    let spec = cronus_parser::from_file(&abs_file, true, search_paths)?;
    let ctx = Ctxt::new(spec);
    generate(&ctx)?;
    ctx.dump()
}


pub fn generate_from_yaml(content: &str) -> Result<String> {
    match cronus_parser::from_yaml_str(content) {
        Ok(spec) => {
            run_raw_spec(spec)
        },
        Err(err) => {
            Err(err)
        },
    }
}

pub fn api_to_yaml(content: &str) -> Result<String> {
    match cronus_parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            let yaml = cronus_parser::to_yaml_str(&spec)?;
            Ok(yaml)
        },
        Err(err) => {
            Err(err)
        },
    }
}

fn run_raw_spec(spec: cronus_spec::RawSpec) -> Result<String> {

    let ctx = Ctxt::new(spec);
    match cronus_generator::generate(&ctx) {
        Ok(_) => {

            let gfs = &*ctx.generator_fs.borrow();
            let  result: HashMap<String, HashMap<String, String>> = gfs
            .iter()
            .map(|(key, value)| {
                let inner_map = value.borrow().clone();
                (key.to_string(), inner_map)
            })
            .collect();
            serde_yaml::to_string(&result).map_err(|e| e.into())
        },
        Err(err) => {
            Err(err)
        },
    }
}

pub fn generate_from_api(content: &str) -> Result<String> {        

    match cronus_parser::api_parse::parse(PathBuf::new(), content) {
        Ok(spec) => {
            run_raw_spec(spec)
        },
        Err(err) => {
            Err(err)
        },
    }

}

