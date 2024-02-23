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