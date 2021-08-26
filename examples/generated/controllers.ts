import {
  ApiTags,
  ApiPropertyOptional,
  ApiProperty,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  Inject,
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import {
  GeneralObjectStatus,
  UserUsercase,
  USER_USERCASE,
  CreateUserRequest,
  GetUserRequest,
  ListUsersRequest,
  VoidRetMethodRequest,
} from './types';
import { User } from '@somewhere/interesting';
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
}
export class BaseRequestDto {
  @ApiPropertyOptional()
  user: JwtUserDto;
}
export class CreateUserRequestDto {
  @ApiPropertyOptional()
  id: number;
  @ApiPropertyOptional()
  name: string;
  @ApiPropertyOptional()
  age: number;
}
export class CreateUserResponseDto {
  @ApiPropertyOptional()
  user: UserDto;
}
export class CreateUserRequestBodyDto {
  @ApiPropertyOptional()
  id: number;
  @ApiPropertyOptional()
  name: string;
  @ApiPropertyOptional()
  age: number;
}
export class GetUserRequestDto {
  @ApiPropertyOptional()
  id: number;
}
export class GetUserResponseDto {
  @ApiPropertyOptional()
  user: UserDto;
}
export class ListUsersRequestDto {
  @ApiPropertyOptional()
  id: number;
  @ApiPropertyOptional()
  name: string;
}
export class ListUsersResponseDto {
  @ApiPropertyOptional({ type: [UserDto] })
  users: UserDto[];
  @ApiPropertyOptional()
  total: number;
}
export class VoidRetMethodRequestDto {}
@Controller('user')
@ApiTags('user')
export class UserUsercaseController {
  constructor(
    @Inject(USER_USERCASE)
    private readonly userUsercase: UserUsercase,
  ) {}
  @Post('users')
  @ApiOkResponse({ type: CreateUserResponseDto })
  createUser(
    @Body()
    body: CreateUserRequestBodyDto,
    @User()
    user,
  ) {
    const ucReq = {
      id: body.id,
      name: body.name,
      age: body.age,
      user,
    } as CreateUserRequest;
    return this.userUsercase.createUser(ucReq);
  }
  @Get('user/:id')
  @ApiOkResponse({ type: GetUserResponseDto })
  getUser(
    @Param('id', ParseIntPipe)
    id: number,
    @User()
    user,
  ) {
    const ucReq = {
      id,
      user,
    } as GetUserRequest;
    return this.userUsercase.getUser(ucReq);
  }
  @Get('users')
  @ApiOkResponse({ type: ListUsersResponseDto })
  listUsers(
    @Query('id', ParseIntPipe)
    id: number,
    @Query('name')
    name: string,
    @User()
    user,
  ) {
    const ucReq = {
      id,
      name,
      user,
    } as ListUsersRequest;
    return this.userUsercase.listUsers(ucReq);
  }
  @Get('abc')
  voidRetMethod(
    @User()
    user,
  ) {
    const ucReq = {
      user,
    } as VoidRetMethodRequest;
    return this.userUsercase.voidRetMethod(ucReq);
  }
}
