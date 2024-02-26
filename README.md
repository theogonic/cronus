# Zeus

Documentation is [here]().

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