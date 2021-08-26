import { BaseGeneralObject, BaseGeneralObjectDao } from '@theogonic/gaea';
import { User } from './types';
export class UserEntity extends BaseGeneralObject implements User {
  constructor(meta: BaseGeneralObject['meta'], obj: Omit<User, 'meta'>) {
    super(meta);
    this.tags = obj.tags;
    this.profile = obj.profile;
  }
  tags: User['tags'];
  profile: User['profile'];
}
export class UserEntityDao extends BaseGeneralObjectDao<UserEntity> {
  target = UserEntity;
}
