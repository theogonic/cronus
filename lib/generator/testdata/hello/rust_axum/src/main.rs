mod generated;
use generated::{CreateHelloRequest, CreateHelloResponse, HelloUsecase};
use async_trait::async_trait;
struct HelloUsecaseImpl {

}

#[async_trait]
impl generated::HelloUsecase for HelloUsecaseImpl {
    async fn create_hello(&self, request: CreateHelloRequest) -> Result<CreateHelloResponse, Box<dyn std::error::Error >> {
        Ok(generated::CreateHelloResponse {
            answer: request.hi
        })
    }

    async  fn get_hello(&self, request: generated::GetHelloRequest) -> Result<generated::GetHelloResponse, Box<dyn std::error::Error>> {
        todo!()
    }
}


fn main() {
    let usecase = HelloUsecaseImpl {};
    usecase.create_hello(CreateHelloRequest{ hi: "world".to_string()});
}
