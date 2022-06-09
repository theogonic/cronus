import { Inject, Logger } from "@nestjs/common";
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from "@nestjs/graphql";
import { GeneralObjectMeta, GeneralObjectStatus, TypedAddress, AddressType, TypedPhone, PhoneType, JustTest, Pagination, User, UserChange } from "./types";
export class GqlGeneralObjectMeta {
    static toRaw(gqlObj): GeneralObjectMeta {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            id: gqlObj.id,
            userId: gqlObj.userId,
            typeId: gqlObj.typeId,
            status: GeneralObjectStatus[gqlObj.status as string],
            updatedAt: gqlObj.updatedAt,
            createdAt: gqlObj.createdAt
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            id: raw.id,
            userId: raw.userId,
            typeId: raw.typeId,
            status: GeneralObjectStatus[raw.status as number],
            updatedAt: raw.updatedAt,
            createdAt: raw.createdAt
        };
    }
}
export class GqlTypedAddress {
    static toRaw(gqlObj): TypedAddress {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            type: AddressType[gqlObj.type as string],
            addr: gqlObj.addr
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            type: AddressType[raw.type as number],
            addr: raw.addr
        };
    }
}
export class GqlTypedPhone {
    static toRaw(gqlObj): TypedPhone {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            type: PhoneType[gqlObj.type as string],
            number: gqlObj.number
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            type: PhoneType[raw.type as number],
            number: raw.number
        };
    }
}
export class GqlJustTest {
    static toRaw(gqlObj): JustTest {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            type: PhoneType[gqlObj.type as string]
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            type: PhoneType[raw.type as number]
        };
    }
}
export class GqlPagination {
    static toRaw(gqlObj): Pagination {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            totalCount: gqlObj.totalCount,
            nextToken: gqlObj.nextToken,
            test: GqlJustTest.toRaw(gqlObj.test)
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            totalCount: raw.totalCount,
            nextToken: raw.nextToken,
            test: GqlJustTest.fromRaw(raw.test)
        };
    }
}
export class GqlUser {
    static toRaw(gqlObj): User {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            avatarUrl: gqlObj.avatarUrl,
            name: gqlObj.name,
            phones: (gqlObj.phones || []).map(GqlTypedPhone.toRaw),
            desc: gqlObj.desc,
            addrs: (gqlObj.addrs || []).map(GqlTypedAddress.toRaw),
            onboarded: gqlObj.onboarded,
            fvrActIds: gqlObj.fvrActIds,
            fvrCatIds: gqlObj.fvrCatIds,
            ethnicity: gqlObj.ethnicity,
            occupation: gqlObj.occupation,
            careerLevel: gqlObj.careerLevel
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            avatarUrl: raw.avatarUrl,
            name: raw.name,
            phones: (raw.phones || []).map(GqlTypedPhone.fromRaw),
            desc: raw.desc,
            addrs: (raw.addrs || []).map(GqlTypedAddress.fromRaw),
            onboarded: raw.onboarded,
            fvrActIds: raw.fvrActIds,
            fvrCatIds: raw.fvrCatIds,
            ethnicity: raw.ethnicity,
            occupation: raw.occupation,
            careerLevel: raw.careerLevel
        };
    }
}
export class GqlUserChange {
    static toRaw(gqlObj): UserChange {
        if (!gqlObj) {
            return gqlObj as any;
        }
        return {
            avatarUrl: gqlObj.avatarUrl,
            name: gqlObj.name,
            phones: (gqlObj.phones || []).map(GqlTypedPhone.toRaw),
            desc: gqlObj.desc,
            addrs: (gqlObj.addrs || []).map(GqlTypedAddress.toRaw),
            onboarded: gqlObj.onboarded,
            fvrActIds: gqlObj.fvrActIds,
            fvrCatIds: gqlObj.fvrCatIds,
            ethnicity: gqlObj.ethnicity,
            occupation: gqlObj.occupation,
            careerLevel: gqlObj.careerLevel
        };
    }
    static fromRaw(raw) {
        if (!raw) {
            return raw as any;
        }
        return {
            avatarUrl: raw.avatarUrl,
            name: raw.name,
            phones: (raw.phones || []).map(GqlTypedPhone.fromRaw),
            desc: raw.desc,
            addrs: (raw.addrs || []).map(GqlTypedAddress.fromRaw),
            onboarded: raw.onboarded,
            fvrActIds: raw.fvrActIds,
            fvrCatIds: raw.fvrCatIds,
            ethnicity: raw.ethnicity,
            occupation: raw.occupation,
            careerLevel: raw.careerLevel
        };
    }
}
