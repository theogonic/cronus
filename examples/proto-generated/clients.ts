import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { CreateUserRequest, CreateUserResponse, GetUserRequest, GetUserResponse, UpdateUserRequest, UpdateUserResponse, ListUsersRequest, ListUsersResponse, AddFvrActRequest, AddFvrActResponse, DelFvrActRequest, DelFvrActResponse, UserService } from "./types";
export abstract class BaseRestClient {
    protected instance: AxiosInstance;
    constructor(config: AxiosRequestConfig) {
        this.instance = axios.create(config);
    }
}
export class UserServiceRestClient extends BaseRestClient implements UserService {
    async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
        throw new Error("this method does not have rest generation setting in zeus definition.");
    }
    async getUser(request: GetUserRequest): Promise<GetUserResponse> {
        const res = await this.instance.request({
            url: `user/${request.userId}`,
            method: "get"
        });
        return res.data;
    }
    async updateUser(request: UpdateUserRequest): Promise<UpdateUserResponse> {
        throw new Error("this method does not have rest generation setting in zeus definition.");
    }
    async listUsers(request: ListUsersRequest): Promise<ListUsersResponse> {
        const res = await this.instance.request({
            url: `users`,
            method: "get"
        });
        return res.data;
    }
    async addFvrAct(request: AddFvrActRequest): Promise<AddFvrActResponse> {
        throw new Error("this method does not have rest generation setting in zeus definition.");
    }
    async delFvrAct(request: DelFvrActRequest): Promise<DelFvrActResponse> {
        throw new Error("this method does not have rest generation setting in zeus definition.");
    }
}
