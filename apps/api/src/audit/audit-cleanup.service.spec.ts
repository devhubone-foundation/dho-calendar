import { AuditCleanupService } from "./audit-cleanup.service";

describe("AuditCleanupService.handleCleanup", () => {
  it("delegates to AuditService.deleteExpired", async () => {
    const deleteExpired = jest.fn().mockResolvedValue(2);
    const service = new AuditCleanupService({ deleteExpired } as never);

    await service.handleCleanup();

    expect(deleteExpired).toHaveBeenCalledTimes(1);
  });

  it("does not throw when nothing was expired", async () => {
    const deleteExpired = jest.fn().mockResolvedValue(0);
    const service = new AuditCleanupService({ deleteExpired } as never);

    await expect(service.handleCleanup()).resolves.toBeUndefined();
  });
});
