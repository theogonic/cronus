struct Todo {
  id: String,
  content: String,
}
struct CreateTodoRequest {
  content: String,
}
struct CreateTodoResponse {
  id: String,
  content: String,
}
trait TodoUsecase {
  async fn createTodo(request: CreateTodoRequest) -> CreateTodoResponse;
}

use axum::{
    extract::State,
    http::{header, Response, StatusCode},
    response::IntoResponse,
    Extension, Json,
    Router
};
pub async fn create_todo(State(state): State<Arc<AppState>>, Json(request): Json<CreateTodoRequest>) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
  todo!();
}
pub fn router_init(router: &Router) {
router.route("/todo", axum::routing::post(create_todo));
};
