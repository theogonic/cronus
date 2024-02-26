## Example

```
global [generator.rust.file = "src/generated.rs"]
global [generator.rust_axum.file = "src/generated.rs"]

global [generator.rust.async]
global [generator.rust.async_trait]

[rest.path = "hello"]
usecase Hello {

  [rest.method = "post"]
  createHello {
      in {
          hi: string
      }
      out {
          answer: string
      }
  }

  [rest.method = "get"]
  [rest.path = "item"]
  getHello {
      in {
          [rest.query]
          hi: string
      }
      out {
          answer: string
      }
  }
}
```

## Pest Grammer
```pest

// Basic rules for whitespace and comments
WHITESPACE = _{ " " | "\t" | "\r" | "\n" }
COMMENT = _{ "//" ~ (!NEWLINE ~ ANY)* }

// Identifiers and basic types
identifier = @{ ASCII_ALPHA ~ (ASCII_ALPHANUMERIC | "_")* }
type_identifier = @{ ASCII_ALPHA ~ (ASCII_ALPHANUMERIC | "_" | "[" | "]")* }
path = @{ (!"\n" ~ ANY)+ }


// Import statements
import = { "import" ~ path }

// Options
option_value = { integer | string | bool | array  }
integer = { ASCII_DIGIT+ }
string = { "\"" ~ (!"\"" ~ ANY)* ~ "\"" }
bool = { "true" | "false" }
array = { "(" ~ (option_value ~ ("," ~ option_value)*)? ~ ")" }
option = { "[" ~ identifier ~ ("." ~ identifier)* ~ ("=" ~ option_value)? ~ "]" }


// Property definitions
property = {     option* ~ identifier ~ optional_property? ~ ":" ~ type_identifier }
optional_property = { "?" }


// Sections for 'in' and 'out' blocks
in_block = { "in" ~ struct_body }
out_block = { "out" ~ struct_body }

// Usecase definitions
usecase = {
    option* ~
    "usecase" ~ identifier ~ "{" ~
    method_def* ~
    "}" 
}

method_def = {
  option* ~
  identifier ~ "{" ~
   in_block? ~
    out_block? ~
  "}"
}

// Struct definitions
struct_def = { 
    option* ~
    "struct" ~ identifier ~ struct_body
}

struct_body = {
	"{" ~

    property* ~
    "}"
}

global_option = {
    "global" ~
    option
}

// Root rule
file = {
    SOI ~
    (usecase | struct_def | import | global_option)* ~
    EOI
}
```

### Basic Rules

- **WHITESPACE**: Matches any whitespace character including space, tab, carriage return, and newline.
- **COMMENT**: Matches comments that start with `//` and continue until the end of the line.

### Identifiers and Basic Types

- **identifier**: Matches an identifier that starts with an ASCII alphabetic character followed by zero or more alphanumeric characters or underscores.
  - Example: `createHello`
- **type_identifier**: Similar to `identifier`, but can also include square brackets `[]` to denote array types.
  - Example: `string`
- **path**: Matches a path, which is a sequence of any characters except newline.
  - Example: `"src/generated.rs"`

### Import Statements

- **import**: Matches an import statement, which starts with the keyword `import` followed by a path.
  - Example: `import "another_file.pest"`

### Options

- **option_value**: Matches an option value, which can be an integer, string, boolean, or array.
  - Example: `"src/generated.rs"`
- **option**: Matches an option, which is an identifier followed by an optional value assignment.
  - Example: `[generator.rust.file = "src/generated.rs"]`

### Property Definitions

- **property**: Matches a property definition, which consists of optional options, an identifier, an optional question mark for optional properties, and a type identifier separated by a colon.
  - Example: `hi: string`

### Sections for 'in' and 'out' Blocks

- **in_block**: Matches an 'in' block, which starts with the keyword `in` followed by a struct body.
  - Example: 
    ```
    in {
        hi: string
    }
    ```
- **out_block**: Matches an 'out' block, which starts with the keyword `out' followed by a struct body.
  - Example: 
    ```
    out {
        answer: string
    }
    ```

### Usecase Definitions

- **usecase**: Matches a usecase definition, which consists of optional options, the keyword `usecase`, an identifier, and a block containing method definitions.
  - Example: 
    ```
    usecase Hello {     
        createHello {
            in {
                hi: string
            }
            out {
                answer: string
            }
        }
    }
    ```

### Method Definitions

- **method_def**: Matches a method definition, which consists of optional options, an identifier, and optional 'in' and 'out' blocks enclosed in curly braces.
  - Example: 
    ```
    [rest.method = "post"]
    createHello {
        in {
            hi: string
        }
        out {
            answer: string
        }
    }
    ```

### Struct Definitions

- **struct_def**: Matches a struct definition, which consists of optional options, the keyword `struct`, an identifier, and a struct body.
  - Example: 
    ```
    struct Person {
        name: string
        age: integer
    }
    ```

### Global Options

- **global_option**: Matches a global option, which starts with the keyword `global` followed by an option.
  - Example: `global [generator.rust.file = "src/generated.rs"]`

### Root Rule

- **file**: The root rule that matches the entire file, which can contain usecase definitions, struct definitions, import statements, and global options.
  - Example: 
    ```
    global [generator.rust.file = "src/generated.rs"]
    usecase Hello {     
        createHello {
            in {
                hi: string
            }
            out {
                answer: string
            }
        }
    }
    ```

This updated documentation provides concrete examples for each section of the DSL, illustrating how the grammar can be used to define usecases, structs, and options in a domain-specific language.