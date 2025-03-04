# Rust Generator

## Configuration

### Global
Used with #[rust.<Config>]

### Config:
| Config | Type      | Description |
|--|--|--|
| file | string? | output .rs file |
| no_default_derive | bool? | Do not place default derive for struct |
| default_derive | string[]? | Default derive(s) for every struct |
| uses | string[]? |Custom extra uses |