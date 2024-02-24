pub struct RustFile {
    pub use_root: RustFileUsesNode,
    pub traits: Vec<RustTrait>
}

pub struct RustTrait {
    pub attributes: Vec<RustAttribute>,
    pub name: String
}

pub struct RustStruct {
    pub attributes: Vec<RustAttribute>,
    pub name: String
}

pub struct RustAttribute {

}

pub struct RustFileUsesNode {
    pub path: String,
    pub next: Vec<Box<RustFileUsesNode>>
}

impl RustFileUsesNode {
    pub fn add(&mut self, use_path: &str) {
        let parts = use_path.split("::");
        let mut current_node = self as *mut RustFileUsesNode;

        for part in parts {
            if let Some(existing_node) = unsafe {&mut (&mut *current_node).next}.iter_mut().find(|node| node.path == part) {
                current_node = existing_node.as_mut() as *mut RustFileUsesNode;
            } else {
                let new_node = Box::new(RustFileUsesNode {
                    path: part.to_string(),
                    next: Vec::new(),
                });
                unsafe {&mut (&mut *current_node).next}.push(new_node);
                current_node = unsafe {&mut (&mut *current_node).next}.last_mut().unwrap().as_mut() as *mut RustFileUsesNode;
            }
        }
        
    }

    pub fn to_rust_uses(&self) -> String {
        fn build_use_statement(node: &RustFileUsesNode, prefix: &str) -> String {
            if node.next.is_empty() {
                return format!("{}{}", prefix, node.path);
            }

            let mut children = node.next.iter().map(|child| build_use_statement(child, "")).collect::<Vec<_>>();
            children.sort(); // Ensure consistent ordering

            if children.len() == 1 {
                format!("{}{}::{}", prefix, node.path, children[0])
            } else {
                format!("{}{}::{{{}}}", prefix, node.path, children.join(", "))
            }
        }

        let mut use_statements = Vec::new();
        for child in &self.next {
            use_statements.push(build_use_statement(child, "use ") + ";");
        }
        use_statements.join("\n")
    }
}

#[cfg(test)]
mod test {
    use crate::rust_utils::RustFileUsesNode;

    #[test]
    fn test_add_single_path() {
        let mut root = RustFileUsesNode {
            path: String::new(),
            next: Vec::new(),
        };
    
        root.add("a::b::c");
    
        assert_eq!(root.next.len(), 1);
        assert_eq!(root.next[0].path, "a");
        assert_eq!(root.next[0].next.len(), 1);
        assert_eq!(root.next[0].next[0].path, "b");
        assert_eq!(root.next[0].next[0].next.len(), 1);
        assert_eq!(root.next[0].next[0].next[0].path, "c");
    }

    #[test]
    fn test_add_two_paths() {
        let mut root = RustFileUsesNode {
            path: String::new(),
            next: Vec::new(),
        };

        root.add("a::b::c");
        root.add("a::b::d");

        assert_eq!(root.next.len(), 1);
        assert_eq!(root.next[0].path, "a");
        assert_eq!(root.next[0].next.len(), 1);
        assert_eq!(root.next[0].next[0].path, "b");
        assert_eq!(root.next[0].next[0].next.len(), 2);
        assert_eq!(root.next[0].next[0].next[0].path, "c");
        assert_eq!(root.next[0].next[0].next[1].path, "d");
    }

    #[test]
    fn test_to_rust_uses_single() {
        let mut root = RustFileUsesNode {
            path: String::new(),
            next: Vec::new(),
        };

        root.add("a::b::c");

        assert_eq!(root.to_rust_uses(), "use a::b::c;");
    }

    #[test]
    fn test_to_rust_uses_combined() {
        let mut root = RustFileUsesNode {
            path: String::new(),
            next: Vec::new(),
        };

        root.add("a::b::d");
        root.add("a::b::e");

        assert_eq!(root.to_rust_uses(), "use a::b::{d, e};");
    }


}