import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminCreateMemberRequest,
  AdminUpdateMemberRequest,
  MemberSummary,
} from "@dho/contracts";

import { AuditService } from "../audit/audit.service";
import { hashPassword } from "../auth/password.util";
import { AppError } from "../common/errors/app-error";
import { throwIfUniqueEmailViolation, toMemberSummary } from "../common/member-summary.util";
import { DomainEventsService } from "../common/domain-events/domain-events.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async list(): Promise<MemberSummary[]> {
    const users = await this.prisma.user.findMany({
      where: { profile: { isNot: null } },
      include: { profile: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((user) => toMemberSummary(user, user.profile!));
  }

  async getById(id: string): Promise<MemberSummary> {
    const user = await this.findWithProfileOrThrow(id);
    return toMemberSummary(user, user.profile!);
  }

  async create(actorId: string, data: AdminCreateMemberRequest): Promise<MemberSummary> {
    const passwordHash = await hashPassword(data.temporaryPassword);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: data.role,
          isActive: true,
          mustChangePassword: true,
          profile: {
            create: {
              fullName: data.fullName,
              qualificationBg: data.qualificationBg,
              qualificationEn: data.qualificationEn,
            },
          },
        },
        include: { profile: true },
      });

      await this.audit.record({
        actorId,
        action: "member.created",
        targetType: "User",
        targetId: user.id,
        metadata: { email: user.email, role: user.role, fullName: data.fullName },
      });
      this.domainEvents.emit("member-status.changed", { userId: user.id });

      return toMemberSummary(user, user.profile!);
    } catch (error) {
      throwIfUniqueEmailViolation(error);
      throw error;
    }
  }

  async update(actorId: string, id: string, data: AdminUpdateMemberRequest): Promise<MemberSummary> {
    await this.findWithProfileOrThrow(id);

    try {
      const [user, profile] = await this.prisma.$transaction([
        this.prisma.user.update({ where: { id }, data: { email: data.email, role: data.role } }),
        this.prisma.memberProfile.update({
          where: { userId: id },
          data: {
            fullName: data.fullName,
            qualificationBg: data.qualificationBg,
            qualificationEn: data.qualificationEn,
          },
        }),
      ]);

      await this.audit.record({
        actorId,
        action: "member.updated",
        targetType: "User",
        targetId: id,
        metadata: { email: data.email, role: data.role, fullName: data.fullName },
      });
      this.domainEvents.emit("profile.changed", { userId: id });

      return toMemberSummary(user, profile);
    } catch (error) {
      throwIfUniqueEmailViolation(error);
      throw error;
    }
  }

  async setActive(actorId: string, id: string, isActive: boolean): Promise<MemberSummary> {
    if (actorId === id && !isActive) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "You cannot deactivate your own account",
      );
    }

    await this.findWithProfileOrThrow(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { profile: true },
    });

    if (!isActive) {
      // Deactivation also takes effect immediately via loadActiveUserOrThrow
      // on the guard's next check; revoking sessions here is defense in depth.
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record({
      actorId,
      action: isActive ? "member.activated" : "member.deactivated",
      targetType: "User",
      targetId: id,
    });
    this.domainEvents.emit("member-status.changed", { userId: id });

    return toMemberSummary(user, user.profile!);
  }

  private async findWithProfileOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!user || !user.profile) {
      throw new NotFoundException("Member not found");
    }
    return user;
  }
}
