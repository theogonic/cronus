
use pest::{Parser, iterators::Pair};

#[derive(pest_derive::Parser)]
#[grammar = "api.pest"]
pub struct APIParser;
