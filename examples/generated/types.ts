export enum GeneralObjectStatus {
  Active = 1,
  Deleted = 2,
}
export interface GeneralObjectMeta {
  id?: string;
  userId?: string;
  typeId?: string;
  status?: GeneralObjectStatus;
  updatedAt?: number;
  createdAt?: number;
}
export interface JwtUser {
  id?: string;
  email?: string;
  org?: string;
}
export interface CreateUserRequest extends BaseRequest {
  id?: number;
  name?: string;
  age?: number;
}
export interface CreateUserResponse {
  user?: User;
}
export interface GetUserRequest extends BaseRequest {
  id?: number;
}
export interface GetUserResponse {
  user?: User;
}
export interface ListUsersRequest extends BaseRequest {
  id?: number;
  name?: string;
}
export interface ListUsersResponse {
  users?: User[];
  total?: number;
}
export type VoidRetMethodRequest = BaseRequest;
export interface UserUsercase {
  createUser(request: CreateUserRequest): Promise<CreateUserResponse>;
  getUser(request: GetUserRequest): Promise<GetUserResponse>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
  voidRetMethod(request: VoidRetMethodRequest): Promise<void>;
}
export const USER_USERCASE = Symbol('USER_USERCASE');
export enum UserType {
  Normal,
  Admin,
}
export interface User {
  tags?: string[];
  profile?: UserProfile;
  meta?: GeneralObjectMeta;
}
export interface UserProfile {
  name?: string;
  email?: string;
}
export interface BaseRequest {
  user?: JwtUser;
}
