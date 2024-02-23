use serde::{Deserialize, Serialize};
use async_trait::async_trait;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHelloRequest {
  pub hi: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHelloResponse {
  pub answer: String,
}
#[async_trait]
pub trait HelloUsecase {
  async fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error>>;
}
