use crate::Generator;


pub struct TauriGenerator {
}

impl TauriGenerator {
    pub fn new() -> Self {
        Self {
           
        }
    }
}

impl Generator for TauriGenerator {
    fn name(&self) -> &'static str {
        return "tauri"
    }

    fn generate(&self, ctx: &crate::Ctxt) {
        todo!()
    }
}