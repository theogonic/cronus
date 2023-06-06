
# Todo service

Let's get started by implementing a Todo service using zeus.

## Define service

```
service Todo {
    createTodo {
        in {
            string todo
        }

        out {
            string id
        }
    }
}
```

## 

