import { User } from './base';

export interface BaseRequest {
  user: User;
}

export interface Action1Request extends BaseRequest {
  helloReq?: string;
}

export interface Action1Response {
  helloBack: string;
}

/**
 * @TscaUsecase
 */
export interface U1 {
  /**
   * @TscaUsecaseMethold
   */
  action1(req: Action1Request): Action1Response;
}
