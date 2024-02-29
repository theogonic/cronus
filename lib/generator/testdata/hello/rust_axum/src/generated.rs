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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GetHelloRequest {
  pub hi: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GetHelloResponse {
  pub answer: String,
}
#[async_trait]
pub trait HelloUsecase {
  async  fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error>>;
  async  fn get_hello(&self, request: GetHelloRequest) -> Result<GetHelloResponse, Box<dyn std::error::Error>>;
}

use axum::{
    extract::State,
    http::{header, Response, StatusCode},
    response::IntoResponse,
    Extension, Json,
    Router
};
pub async fn create_hello(State(state): State<std::sync::Arc<Usecases>>, Json(request): Json<CreateHelloRequest>) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {

    match state.hello.create_hello(request).await {
        Ok(res) => {
            Ok(Json(res))
        },
        Err(err) => {
            let mut err_obj = serde_json::Map::new();
            err_obj.insert("message".to_owned(), serde_json::Value::from(err.to_string()));
            Err((StatusCode::BAD_REQUEST, Json(serde_json::Value::Object(err_obj))))
        },
        }
    }
pub async fn get_hello(State(state): State<std::sync::Arc<Usecases>>, Json(request): Json<GetHelloRequest>) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {

    match state.hello.get_hello(request).await {
        Ok(res) => {
            Ok(Json(res))
        },
        Err(err) => {
            let mut err_obj = serde_json::Map::new();
            err_obj.insert("message".to_owned(), serde_json::Value::from(err.to_string()));
            Err((StatusCode::BAD_REQUEST, Json(serde_json::Value::Object(err_obj))))
        },
        }
    }
#[derive(Clone)]
pub struct Usecases {
  pub hello: std::sync::Arc<dyn HelloUsecase + Send + Sync>,
}
pub fn router_init(usecases: std::sync::Arc<Usecases>) -> Router {
  Router::new()
    .route("", axum::routing::post(create_hello))
    .route("item", axum::routing::get(get_hello))
    .with_state(usecases)
}
