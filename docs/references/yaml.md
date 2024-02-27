**For the users, it is recommended to use [API style](api.md) instead of YAML style to write API spec due to the consideration of readability and convenience.**

To create a valid YAML file that represents an API specification (`RawSpec`), you need to follow the structure defined by the Rust structs. Here's a documentation guide on how to define keys and values in the YAML file:

### RawSpec

The root structure for the API Spec. It contains the following optional fields:

- `types`: A map of type names to `RawSchema` objects.
- `usecases`: A map of use case names to `RawUsecase` objects.
- `option`: A `GlobalOption` object with global configuration options.
- `imports`: A list of strings representing import paths.

Example:

```yaml
types:
  MyType:
    type: object
    properties:
      id:
        type: string
        required: true
usecases:
  MyUsecase:
    methods:
      myMethod:
        req:
          type: object
          properties:
            id:
              type: string
              required: true
        res:
          type: object
          properties:
            message:
              type: string
              required: true
option:
  generator:
    rust:
      file: "output.rs"
imports:
  - "path/to/another/spec.yaml"
```

### RawSchema

Defines the schema for a type. It has the following optional fields:

- `type`: The type of the schema (e.g., "string", "object").
- `items`: A `RawSchema` object for array item types.
- `properties`: A map of property names to `RawSchema` objects for object types.
- `required`: A boolean indicating if the schema is required.
- `namespace`: A string specifying the namespace for the type.
- `enum_items`: A list of `RawSchemaEnumItem` objects for enum types.
- `option`: A `RawSchemaPropertyOption` object with additional options.
- `extends`: A map of strings for extending other schemas.
- `flat_extends`: A list of strings for flat extending other schemas.

### RawUsecase

Represents a use case in the API. It contains:

- `methods`: A map of method names to `RawUsecaseMethod` objects.
- `option`: An optional `RawUsecaseOption` object with additional options.

### RawUsecaseMethod

Defines a method in a use case. It has the following optional fields:

- `req`: A `RawSchema` object for the request schema.
- `res`: A `RawSchema` object for the response schema.
- `option`: A `RawUsecaseMethodOption` object with additional options.

### GlobalOption, GeneratorOption, RustGeneratorOption, etc.

These structs define various configuration options for the generator. They contain fields that specify file paths, suffixes, and other generator-specific options.

When creating your YAML file, you should match the structure and field names defined in these Rust structs. Each key in the YAML file corresponds to a field in the Rust struct, and the value should match the expected type (e.g., string, boolean, object, list).