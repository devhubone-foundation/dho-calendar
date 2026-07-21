import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  type AdminCreateMemberRequest,
  adminCreateMemberRequestSchema,
  type AdminUpdateMemberRequest,
  adminUpdateMemberRequestSchema,
  type AuthenticatedUser,
  type MemberListResponse,
  type MemberStatusUpdateRequest,
  memberStatusUpdateRequestSchema,
  type MemberSummary,
} from "@dho/contracts";

import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(RolesGuard)
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(): Promise<MemberListResponse> {
    return { members: await this.usersService.list() };
  }

  @Get(":id")
  getById(@Param("id") id: string): Promise<MemberSummary> {
    return this.usersService.getById(id);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body(new ZodValidationPipe(adminCreateMemberRequestSchema)) body: AdminCreateMemberRequest,
  ): Promise<MemberSummary> {
    return this.usersService.create(actor.id, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adminUpdateMemberRequestSchema)) body: AdminUpdateMemberRequest,
  ): Promise<MemberSummary> {
    return this.usersService.update(actor.id, id, body);
  }

  @Patch(":id/status")
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(memberStatusUpdateRequestSchema)) body: MemberStatusUpdateRequest,
  ): Promise<MemberSummary> {
    return this.usersService.setActive(actor.id, id, body.isActive);
  }
}
