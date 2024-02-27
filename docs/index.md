# Cronus
Cronus aims to help you focusing on **business logic code only** instead of the other **glue code**.

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

## CLI Usage
```bash
$ Cronus <your api file>
# Ex. Cronus main.api
```


## What is the **Clean Architecture** and Why we need it? 
[The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html), tl;dr, proposed by Robert C. Martin, offers several benefits during software development.

- **Independent of Frameworks:** 
  The architecture does not depend on specific libraries or frameworks, enhancing robustness and flexibility.

- **Testability:** 
  Business rules can be tested independently of UI, database, web server, or other external elements.

- **Independence of UI:** 
  UI can change easily without affecting the business rules, allowing for flexibility in user interface design.

- **Independence of Database:** 
  Business rules are not tied to a specific database, facilitating easy changes in database technologies.

- **Independence from External Agencies:**
  Business rules remain unaffected by external changes, maintaining their integrity and effectiveness.

- **Manageable Complexity:** 
  Separation of concerns makes the code more manageable and different aspects of the application more understandable.

- **Adaptability to Change:** 
  The architecture is adaptable to changing requirements and technology shifts, thanks to its decoupled nature.

- **Reusability:** 
  Components and business logic can be reused across different parts of the application or in various projects.

- **Scalability:** 
  Decoupled layers allow for independent scalability and parallel development across multiple teams.

- **Maintainability:** 
  The separation of concerns enhances maintainability, simplifying issue resolution and system updates.

- **Clear Business Rules:** 
  Business logic is clear and distinct, making it easier to understand, maintain, and develop further.
