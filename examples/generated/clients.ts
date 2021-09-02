import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { UserUsercase } from "./types";
export abstract class BaseRestClient {
    protected instance: AxiosInstance;
    constructor(config: AxiosRequestConfig) {
        this.instance = axios.create(config);
    }
}
export class UserUsercaseRestClient extends BaseRestClient implements UserUsercase {
}
