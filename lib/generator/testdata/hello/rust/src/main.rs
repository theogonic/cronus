mod generated;
use generated::{CreateHelloRequest, CreateHelloResponse, HelloUsecase};
use async_trait::async_trait;

struct HelloUsecaseImpl {

}

#[async_trait]
impl generated::HelloUsecase for HelloUsecaseImpl {
    async fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error>> {
        Ok(generated::CreateHelloResponse {
            answer: request.hi
        })
    }
}


fn main() {
    let usecase = HelloUsecaseImpl {};
    usecase.create_hello(CreateHelloRequest{ hi: "world".to_string()});
}
