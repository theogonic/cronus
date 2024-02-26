use serde::{Deserialize, Serialize};
use async_trait::async_trait;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Todo {
  pub id: String,
  pub content: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateTodoRequest {
  pub content: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CreateTodoResponse {
  pub todo: Todo,
}
#[async_trait]
pub trait TodoUsecase {
  async  fn create_todo(&self, request: CreateTodoRequest) -> Result<CreateTodoResponse, Box<dyn std::error::Error>>;
}

use axum::{
    extract::State,
    http::{header, Response, StatusCode},
    response::IntoResponse,
    Extension, Json,
    Router
};
pub async fn create_todo(State(state): State<std::sync::Arc<Usecases>>, Json(request): Json<CreateTodoRequest>) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {

  match state.todo.create_todo(request).await {
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
  pub todo: std::sync::Arc<dyn TodoUsecase + Send + Sync>,
}
pub fn router_init(usecases: std::sync::Arc<Usecases>) -> Router {
  Router::new()
    .route("", axum::routing::post(create_todo))
    .with_state(usecases)
}
