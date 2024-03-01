# Cronus

[![Crates.io](https://img.shields.io/crates/v/cronus_cli)](https://crates.io/crates/cronus_cli)

Cronus aims to help you focusing on **business logic code only** instead of the other **glue code**.



Documentation is [here](https://theogonic.github.io/cronus).

## Introduction
Cronus contains a list of code generators, which insipred by the **Clean Architecture**, for **Rust**, **Typescript**, **OpenAPI**, and more.

According to one or more configuration files( can be either in YAML (.yml or .yaml) or our DSL(.api) ),  **Cronus** can generate nice and clean business logic related code and glue code for a bunch of different controller layers(HTTP, GraphQL, etc.) powered by different libraries or frameworks.


Cronus
```
# More fine-grained configuration can be found at documentation

# For 'rust' generator
global [generator.rust.file = "src/generated.rs"]
global [generator.rust.async]
global [generator.rust.async_trait]

# For 'rust_axum' generator
global [generator.rust_axum.file = "src/generated.rs"]


struct Todo {
  id: string
  content: string
}

usecase Todo {
  createTodo {
      in {
          content: string
      }

      out {
          todo: Todo
      }
  }
}
```

**Cronus** can be used to generate the following **Business Logic** interface code:


Generated Rust
```rust
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
```

**Cronus** can even step further to generate the following **Controller** glue code:

Generated Rust (Axum)
```rust
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
```

## Generators
- Rust
- Axum(Rust) (work in progress)
- OpenAPI v3
- Tauri (work in progress)

## Dev

### Common

```bash
# Run the generators by the given API spec
$ cargo run -- examples/todo/main.api
```

## Docs

### Dev
```bash
$ pip install mkdocs-material
$ mkdocs serve -f mkdocs.yaml
```

### Publish
```bash
$ mkdocs gh-deploy
```