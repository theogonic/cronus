mod generated;
use generated::{CreateHelloRequest, CreateHelloResponse, HelloUsecase};

struct HelloUsecaseImpl {

}

impl generated::HelloUsecase for HelloUsecaseImpl {
    fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error >> {
        Ok(generated::CreateHelloResponse {
            answer: request.hi
        })
    }
}


fn main() {
    let usecase = HelloUsecaseImpl {};
    usecase.create_hello(CreateHelloRequest{ hi: "world".to_string()});
}
