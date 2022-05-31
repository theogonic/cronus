import { ApiTags, ApiPropertyOptional, ApiProperty, ApiOkResponse } from "@nestjs/swagger";
import { Inject, Controller, Get, Post, Delete, Put, Param, Query, Body, ParseIntPipe, ParseBoolPipe } from "@nestjs/common";
import { AddressType, PhoneType, UserService, USER_SERVICE, GeneralObjectStatus } from "./types";
export class JwtUserDto {
    @ApiPropertyOptional()
    id: string;
    @ApiPropertyOptional()
    email: string;
    @ApiPropertyOptional()
    org: string;
    @ApiPropertyOptional({ type: [String] })
    roles: string[];
}
export class BaseServiceRequestDto {
    @ApiPropertyOptional()
    invoker: JwtUserDto;
}
export class LatLngDto {
    @ApiPropertyOptional()
    lat: float;
    @ApiPropertyOptional()
    lon: float;
}
export class AddressDto {
    @ApiPropertyOptional()
    street1: string;
    @ApiPropertyOptional()
    street2: string;
    @ApiPropertyOptional()
    city: string;
    @ApiPropertyOptional()
    state: string;
    @ApiPropertyOptional()
    country: string;
    @ApiPropertyOptional()
    zipcode: string;
}
export class LocationDto {
    @ApiPropertyOptional()
    latlng: LatLngDto;
    @ApiPropertyOptional()
    url: string;
    @ApiPropertyOptional()
    addr: AddressDto;
}
export class TypedAddressDto {
    @ApiPropertyOptional({ enum: AddressType })
    type: AddressType;
    @ApiPropertyOptional()
    addr: AddressDto;
}
export class TypedPhoneDto {
    @ApiPropertyOptional({ enum: PhoneType })
    type: PhoneType;
    @ApiPropertyOptional()
    number: string;
}
export class UserDto {
    @ApiPropertyOptional()
    avatarUrl: string;
    @ApiPropertyOptional()
    name: string;
    @ApiPropertyOptional({ type: [TypedPhoneDto] })
    phones: TypedPhoneDto[];
    @ApiPropertyOptional()
    desc: string;
    @ApiPropertyOptional({ type: [TypedAddressDto] })
    addrs: TypedAddressDto[];
    @ApiPropertyOptional()
    onboarded: bool;
    @ApiPropertyOptional({ type: [String] })
    fvrActIds: string[];
    @ApiPropertyOptional({ type: [String] })
    fvrCatIds: string[];
    @ApiPropertyOptional()
    ethnicity: string;
    @ApiPropertyOptional()
    occupation: string;
    @ApiPropertyOptional()
    careerLevel: string;
    @ApiPropertyOptional()
    meta: GeneralObjectMetaDto;
}
export class UserChangeDto {
    @ApiPropertyOptional()
    avatarUrl: string;
    @ApiPropertyOptional()
    name: string;
    @ApiPropertyOptional({ type: [TypedPhoneDto] })
    phones: TypedPhoneDto[];
    @ApiPropertyOptional()
    desc: string;
    @ApiPropertyOptional({ type: [TypedAddressDto] })
    addrs: TypedAddressDto[];
    @ApiPropertyOptional()
    onboarded: bool;
    @ApiPropertyOptional({ type: [String] })
    fvrActIds: string[];
    @ApiPropertyOptional({ type: [String] })
    fvrCatIds: string[];
    @ApiPropertyOptional()
    ethnicity: string;
    @ApiPropertyOptional()
    occupation: string;
    @ApiPropertyOptional()
    careerLevel: string;
}
@Controller("user")
export class UserServiceController {
    constructor(
    @Inject(USER_SERVICE)
    private readonly userService: UserService) { }
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
