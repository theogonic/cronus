use serde::{Deserialize, Serialize};
use async_trait::async_trait;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateHelloRequest {
  pub hi: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateHelloResponse {
  pub answer: String,
}
pub trait HelloUsecase {
  fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error>>;
}
