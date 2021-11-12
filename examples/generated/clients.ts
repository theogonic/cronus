import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { CreateUserRequest, CreateUserResponse, GetUserRequest, GetUserResponse, MeRequest, MeResponse, ListUsersRequest, ListUsersResponse, VoidRetMethodRequest, VoidRetMethodResponse, UserUsercase } from "./types";
export abstract class BaseRestClient {
    protected instance: AxiosInstance;
    constructor(config: AxiosRequestConfig) {
        this.instance = axios.create(config);
    }
}
export class UserUsercaseRestClient extends BaseRestClient implements UserUsercase {
    createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
    }
    getUser(request: GetUserRequest): Promise<GetUserResponse> {
    }
    me(request: MeRequest): Promise<MeResponse> {
    }
    listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
    }
    voidRetMethod(request: VoidRetMethodRequest): Promise<VoidRetMethodResponse> {
    }
}
