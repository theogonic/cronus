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
export interface CreateUserRequest extends BaseServiceRequest {
  userId?: string;
}
export interface CreateUserResponse {
  user?: User;
}
export interface GetUserRequest extends BaseServiceRequest {
  userId?: string;
}
export interface GetUserResponse {
  user?: User;
}
export interface UpdateUserRequest extends BaseServiceRequest {
  id?: string;
  user?: UserChange;
}
export interface UpdateUserResponse {
  user?: User;
}
export interface ListUsersRequest extends BaseServiceRequest {
  id?: string;
  name?: string;
  pagination?: Pagination;
}
export interface ListUsersResponse {
  totalCount?: number;
  nextToken?: string;
  items?: User[];
}
export interface AddFvrActRequest extends BaseServiceRequest {
  activityId?: string;
}
export interface AddFvrActResponse {
  activityId?: string;
}
export interface DelFvrActRequest extends BaseServiceRequest {
  activityId?: string;
}
export interface DelFvrActResponse {
  activityId?: string;
}
export interface UserService {
  createUser(request: CreateUserRequest): Promise<CreateUserResponse>;
  getUser(request: GetUserRequest): Promise<GetUserResponse>;
  updateUser(request: UpdateUserRequest): Promise<UpdateUserResponse>;
  listUsers(request: ListUsersRequest): Promise<ListUsersResponse>;
  addFvrAct(request: AddFvrActRequest): Promise<AddFvrActResponse>;
  delFvrAct(request: DelFvrActRequest): Promise<DelFvrActResponse>;
}
export const USER_SERVICE = Symbol('USER_SERVICE');
export interface JwtUser {
  id?: string;
  email?: string;
  org?: string;
  roles?: string[];
}
export interface BaseServiceRequest {
  invoker?: JwtUser;
}
export enum AddressType {
  Work,
  Home = 1,
  School = 2,
}
export interface LatLng {
  lat?: number;
  lon?: number;
}
export interface Address {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}
export interface Location {
  latlng?: LatLng;
  url?: string;
  addr?: Address;
}
export interface TypedAddress {
  type?: AddressType;
  addr?: Address;
}
export enum PhoneType {
  Personal,
}
export interface TypedPhone {
  type?: PhoneType;
  number?: string;
}
export interface JustTest {
  type?: PhoneType;
}
export interface Pagination {
  totalCount?: number;
  nextToken?: string;
  test?: JustTest;
}
export interface User {
  avatarUrl?: string;
  name?: string;
  phones?: TypedPhone[];
  desc?: string;
  addrs?: TypedAddress[];
  onboarded?: boolean;
  fvrActIds?: string[];
  fvrCatIds?: string[];
  ethnicity?: string;
  occupation?: string;
  careerLevel?: string;
}
export interface UserChange {
  avatarUrl?: string;
  name?: string;
  phones?: TypedPhone[];
  desc?: string;
  addrs?: TypedAddress[];
  onboarded?: boolean;
  fvrActIds?: string[];
  fvrCatIds?: string[];
  ethnicity?: string;
  occupation?: string;
  careerLevel?: string;
}
export interface UserCreateEventBody {
  name?: string;
}
export interface UserCreateEvent {
  name?: 'wnl.user.create';
  body?: UserCreateEventBody;
}
