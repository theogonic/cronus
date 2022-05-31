import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { UserService } from "./types";
export abstract class BaseRestClient {
    protected instance: AxiosInstance;
    constructor(config: AxiosRequestConfig) {
        this.instance = axios.create(config);
    }
}
export class UserServiceRestClient extends BaseRestClient implements UserService {
}
