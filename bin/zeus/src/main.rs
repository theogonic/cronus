#![feature(absolute_path)]

use clap::Parser;
use generator::{Ctxt, generate};
use tracing::{Level, span, debug};
use anyhow::Result;
use tracing_subscriber::{util::SubscriberInitExt, fmt::format::FmtSpan};
use std::{fs::metadata, error::Error, path::{Path, PathBuf}};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Entrypoint: .yaml, .yml or .api
    target: String
}

fn main() -> Result<(), Box<dyn Error>> {
    // tracing_subscriber::FmtSubscriber::builder()
    // .with_level(true)
    // .with_max_level(Level::TRACE)
    // .with_span_events(FmtSpan::CLOSE)
    // .init();

    let args = Args::parse();
    let target_path = PathBuf::from(args.target);
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

    Ok(())
    
}


#[tracing::instrument]
pub fn run(entry_file: &Path, search_paths: Option<&Vec<PathBuf>>) -> Result<()> {
    let abs_file = std::path::absolute(entry_file)?;
    let spec = parser::from_file(&abs_file, true, search_paths)?;
    let ctx = Ctxt::new(spec);
    generate(&ctx)
}
