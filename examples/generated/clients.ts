import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { GeneralObjectStatus, CreateUserRequest, CreateUserResponse, GetUserRequest, GetUserResponse, MeRequest, MeResponse, ListUsersRequest, ListUsersResponse, VoidRetMethodRequest, VoidRetMethodResponse, UserUsercase, UserType } from "./types";
import { url } from "inspector";
export abstract class BaseRestClient {
    protected instance: AxiosInstance;
    constructor(config: AxiosRequestConfig) {
        this.instance = axios.create(config);
    }
}
export class GeneralObjectMetaDto {
    @ApiPropertyOptional()
    id: string;
    @ApiPropertyOptional()
    userId: string;
    @ApiPropertyOptional()
    typeId: string;
    @ApiPropertyOptional({ enum: GeneralObjectStatus })
    status: GeneralObjectStatus;
    @ApiPropertyOptional()
    updatedAt: number;
    @ApiPropertyOptional()
    createdAt: number;
}
export class JwtUserDto {
    @ApiPropertyOptional()
    id: string;
    @ApiPropertyOptional()
    email: string;
    @ApiPropertyOptional()
    org: string;
}
export class CreateUserRequestDto {
    @ApiPropertyOptional()
    id: number;
    @ApiPropertyOptional()
    user: UserChangeDto;
}
export class GetUserRequestDto {
    @ApiPropertyOptional()
    id: number;
}
export class MeRequestDto {
}
export class ListUsersRequestDto {
    @ApiPropertyOptional()
    id: number;
    @ApiPropertyOptional()
    name: string;
}
export class VoidRetMethodRequestDto {
}
export class UserDto {
    @ApiPropertyOptional({ type: [String] })
    tags: string[];
    @ApiPropertyOptional()
    profile: UserProfileDto;
    @ApiPropertyOptional()
    meta: GeneralObjectMetaDto;
}
export class UserProfileDto {
    @ApiPropertyOptional()
    name: string;
    @ApiPropertyOptional()
    email: string;
    @ApiPropertyOptional({ enum: UserType })
    type: UserType;
}
export class BaseRequestDto {
    @ApiPropertyOptional()
    user: JwtUserDto;
}
export class UserChangeDto {
    @ApiPropertyOptional()
    name: string;
    @ApiPropertyOptional()
    profile: UserProfileDto;
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
