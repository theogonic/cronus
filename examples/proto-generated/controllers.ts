import {
  ApiTags,
  ApiPropertyOptional,
  ApiProperty,
  ApiOkResponse,
  ApiBearerAuth,
  ApiQuery,
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
  ParseBoolPipe,
} from '@nestjs/common';
import {
  GeneralObjectStatus,
  GeneralObjectMeta,
  AddressType,
  TypedAddress,
  PhoneType,
  TypedPhone,
  JustTest,
  Pagination,
  User,
  UserChange,
  UserService,
  USER_SERVICE,
  GetUserResponse,
  GetUserRequest,
  ListUsersResponse,
  ListUsersRequest,
} from './types';
import { User } from '@lib/std/decorators';
export class GeneralObjectMetaDto {
  @ApiPropertyOptional()
  id?: string;
  @ApiPropertyOptional()
  userId?: string;
  @ApiPropertyOptional()
  typeId?: string;
  @ApiPropertyOptional({ enum: GeneralObjectStatus })
  status?: string;
  @ApiPropertyOptional()
  updatedAt?: number;
  @ApiPropertyOptional()
  createdAt?: number;
  static fromRaw(raw: GeneralObjectMeta): GeneralObjectMetaDto {
    if (!raw) {
      return raw as any;
    }
    return {
      id: raw.id,
      userId: raw.userId,
      typeId: raw.typeId,
      status: GeneralObjectStatus[raw.status],
      updatedAt: raw.updatedAt,
      createdAt: raw.createdAt,
    };
  }
}
export class JwtUserDto {
  @ApiPropertyOptional()
  id?: string;
  @ApiPropertyOptional()
  email?: string;
  @ApiPropertyOptional()
  org?: string;
  @ApiPropertyOptional({ type: [String] })
  roles?: string[];
}
export class BaseServiceRequestDto {
  @ApiPropertyOptional()
  invoker?: JwtUserDto;
}
export class LatLngDto {
  @ApiPropertyOptional()
  lat?: number;
  @ApiPropertyOptional()
  lon?: number;
}
export class AddressDto {
  @ApiPropertyOptional()
  street1?: string;
  @ApiPropertyOptional()
  street2?: string;
  @ApiPropertyOptional()
  city?: string;
  @ApiPropertyOptional()
  state?: string;
  @ApiPropertyOptional()
  country?: string;
  @ApiPropertyOptional()
  zipcode?: string;
}
export class LocationDto {
  @ApiPropertyOptional()
  latlng?: LatLngDto;
  @ApiPropertyOptional()
  url?: string;
  @ApiPropertyOptional()
  addr?: AddressDto;
}
export class TypedAddressDto {
  @ApiPropertyOptional({ enum: AddressType })
  type?: string;
  @ApiPropertyOptional()
  addr?: AddressDto;
  static fromRaw(raw: TypedAddress): TypedAddressDto {
    if (!raw) {
      return raw as any;
    }
    return {
      type: AddressType[raw.type],
      addr: raw.addr,
    };
  }
}
export class TypedPhoneDto {
  @ApiPropertyOptional({ enum: PhoneType })
  type?: string;
  @ApiPropertyOptional()
  number?: string;
  static fromRaw(raw: TypedPhone): TypedPhoneDto {
    if (!raw) {
      return raw as any;
    }
    return {
      type: PhoneType[raw.type],
      number: raw.number,
    };
  }
}
export class JustTestDto {
  @ApiPropertyOptional({ enum: PhoneType })
  type?: string;
  static fromRaw(raw: JustTest): JustTestDto {
    if (!raw) {
      return raw as any;
    }
    return {
      type: PhoneType[raw.type],
    };
  }
}
export class PaginationDto {
  @ApiPropertyOptional()
  totalCount?: number;
  @ApiPropertyOptional()
  nextToken?: string;
  @ApiPropertyOptional()
  test?: JustTestDto;
  static fromRaw(raw: Pagination): PaginationDto {
    if (!raw) {
      return raw as any;
    }
    return {
      totalCount: raw.totalCount,
      nextToken: raw.nextToken,
      test: JustTestDto.fromRaw(raw.test),
    };
  }
}
export class UserDto {
  @ApiPropertyOptional()
  avatarUrl?: string;
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional({ type: [TypedPhoneDto] })
  phones?: TypedPhoneDto[];
  @ApiPropertyOptional()
  desc?: string;
  @ApiPropertyOptional({ type: [TypedAddressDto] })
  addrs?: TypedAddressDto[];
  @ApiPropertyOptional()
  onboarded?: boolean;
  @ApiPropertyOptional({ type: [String] })
  fvrActIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  fvrCatIds?: string[];
  @ApiPropertyOptional()
  ethnicity?: string;
  @ApiPropertyOptional()
  occupation?: string;
  @ApiPropertyOptional()
  careerLevel?: string;
  static fromRaw(raw: User): UserDto {
    if (!raw) {
      return raw as any;
    }
    return {
      avatarUrl: raw.avatarUrl,
      name: raw.name,
      phones: (raw.phones || []).map(TypedPhoneDto.fromRaw),
      desc: raw.desc,
      addrs: (raw.addrs || []).map(TypedAddressDto.fromRaw),
      onboarded: raw.onboarded,
      fvrActIds: raw.fvrActIds,
      fvrCatIds: raw.fvrCatIds,
      ethnicity: raw.ethnicity,
      occupation: raw.occupation,
      careerLevel: raw.careerLevel,
    };
  }
}
export class UserChangeDto {
  @ApiPropertyOptional()
  avatarUrl?: string;
  @ApiPropertyOptional()
  name?: string;
  @ApiPropertyOptional({ type: [TypedPhoneDto] })
  phones?: TypedPhoneDto[];
  @ApiPropertyOptional()
  desc?: string;
  @ApiPropertyOptional({ type: [TypedAddressDto] })
  addrs?: TypedAddressDto[];
  @ApiPropertyOptional()
  onboarded?: boolean;
  @ApiPropertyOptional({ type: [String] })
  fvrActIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  fvrCatIds?: string[];
  @ApiPropertyOptional()
  ethnicity?: string;
  @ApiPropertyOptional()
  occupation?: string;
  @ApiPropertyOptional()
  careerLevel?: string;
  static fromRaw(raw: UserChange): UserChangeDto {
    if (!raw) {
      return raw as any;
    }
    return {
      avatarUrl: raw.avatarUrl,
      name: raw.name,
      phones: (raw.phones || []).map(TypedPhoneDto.fromRaw),
      desc: raw.desc,
      addrs: (raw.addrs || []).map(TypedAddressDto.fromRaw),
      onboarded: raw.onboarded,
      fvrActIds: raw.fvrActIds,
      fvrCatIds: raw.fvrCatIds,
      ethnicity: raw.ethnicity,
      occupation: raw.occupation,
      careerLevel: raw.careerLevel,
    };
  }
}
export class GetUserResponseDto {
  @ApiPropertyOptional()
  user?: UserDto;
  static fromRaw(raw: GetUserResponse): GetUserResponseDto {
    if (!raw) {
      return raw as any;
    }
    return {
      user: UserDto.fromRaw(raw.user),
    };
  }
}
export class ListUsersResponseDto {
  @ApiPropertyOptional()
  totalCount?: number;
  @ApiPropertyOptional()
  nextToken?: string;
  @ApiPropertyOptional({ type: [UserDto] })
  items?: UserDto[];
  static fromRaw(raw: ListUsersResponse): ListUsersResponseDto {
    if (!raw) {
      return raw as any;
    }
    return {
      totalCount: raw.totalCount,
      nextToken: raw.nextToken,
      items: (raw.items || []).map(UserDto.fromRaw),
    };
  }
}
@Controller('user')
@ApiTags('user')
export class UserServiceController {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: UserService,
  ) {}
  @Get('user/:userId')
  @ApiOkResponse({ type: GetUserResponseDto })
  async getUser(
    @Param('userId')
    userId: string,
    @User()
    invoker,
  ): Promise<GetUserResponseDto> {
    const _req: GetUserRequest = {
      userId,
      invoker,
    };
    const _res = await this.userService.getUser(_req);
    return GetUserResponseDto.fromRaw(_res);
  }
  @Get('users')
  @ApiOkResponse({ type: ListUsersResponseDto })
  @ApiQuery({ name: 'id', required: false })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'p_totalCount', required: false })
  @ApiQuery({ name: 'p_nextToken', required: false })
  @ApiQuery({ name: 'p_t_type', required: false, enum: PhoneType })
  async listUsers(
    @Query('id')
    id: string,
    @Query('name')
    name: string,
    @Query('p_totalCount', ParseIntPipe)
    p_totalCount: number,
    @Query('p_nextToken')
    p_nextToken: string,
    @Query('p_t_type')
    p_t_type: string,
    @User()
    invoker,
  ): Promise<ListUsersResponseDto> {
    const _req: ListUsersRequest = {
      id: id,
      name: name,
      pagination: {
        totalCount: p_totalCount,
        nextToken: p_nextToken,
        test: {
          type: PhoneType[p_t_type],
        },
      },
      invoker,
    };
    const _res = await this.userService.listUsers(_req);
    return ListUsersResponseDto.fromRaw(_res);
  }
}
