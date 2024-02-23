# Zeus

## Introduction
A list of **Clean Architecture** code generators for *Typescript* and *Rust*. 

According to one or more configuration files( can be either in YAML (.yml or .yaml) or our DSL(.api) ),  **Zeus** can generate nice and clean business logic related code and glue code for a bunch of different controller layers(HTTP, GraphQL, etc.) powered by different libraries or frameworks. 


=== "DSL"
    ```
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

=== "YAML"
    ```yaml

    ```


**Zeus** can generate the following **Business Logic** interface code:


=== "Generated Typescript"
    ```typescript
    export interface TodoUsecase {

    }
    ```

=== "Generated Rust"
    ```rust 
    
    ```

**Zeus** can even step further to generate the following **Controller** glue code:

=== "Generated Typescript (Nestjs)"
    ```typescript
    export interface TodoUsecase {

    }
    ```

=== "Generated Rust (Axum)"
    ```rust 
    
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
