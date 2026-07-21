import { AppError } from "../common/errors/app-error";
import { UsersService } from "./users.service";

describe("UsersService.setActive", () => {
  it("rejects an admin trying to deactivate their own account", async () => {
    const prisma = { user: { findUnique: jest.fn() } } as never;
    const audit = { record: jest.fn() } as never;
    const service = new UsersService(prisma, audit);

    await expect(service.setActive("admin-1", "admin-1", false)).rejects.toBeInstanceOf(AppError);
  });

  it("allows an admin to reactivate their own account", async () => {
    const user = {
      id: "admin-1",
      email: "admin@devhubone.local",
      role: "ADMIN",
      isActive: false,
      mustChangePassword: false,
      profile: {
        fullName: "Admin",
        qualificationBg: "Админ",
        qualificationEn: "Admin",
        profileImagePath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({ ...user, isActive: true }),
      },
      refreshToken: { updateMany: jest.fn() },
    } as never;
    const audit = { record: jest.fn() } as never;
    const service = new UsersService(prisma, audit);

    await expect(service.setActive("admin-1", "admin-1", true)).resolves.toMatchObject({
      id: "admin-1",
      isActive: true,
    });
  });
});
