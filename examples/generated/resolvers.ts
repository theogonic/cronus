import { Inject, Logger } from "@nestjs/common";
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver, ResolveReference } from "@nestjs/graphql";
import { UserUsercase, USER_USERCASE, JwtUser } from "./types";
@Resolver()
export class UserUsercaseResolver {
    constructor(
    @Inject(USER_USERCASE)
    private readonly userUsercase: UserUsercase) { }
    @Mutation()
    async createUser(
    @Context("user")
    invoker: JwtUser, 
    @Args("request")
    request) {
        return this.userUsercase.createUser({
            invoker,
            ...request
        });
    }
    @Query()
    async getUser(
    @Context("user")
    invoker: JwtUser, 
    @Args("request")
    request) {
        return this.userUsercase.getUser({
            invoker,
            ...request
        });
    }
    @Query()
    async me(
    @Context("user")
    invoker: JwtUser, 
    @Args("request")
    request) {
        return this.userUsercase.me({
            invoker,
            ...request
        });
    }
}
