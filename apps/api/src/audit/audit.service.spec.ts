import { AUDIT_RETENTION_DAYS } from "./audit.constants";
import { AuditService } from "./audit.service";

const SEVEN_DAYS_MS = AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

describe("AuditService.findRecent", () => {
  it("queries only entries created within the retention window, most recent first", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "log-1",
        actorId: "user-1",
        actor: { email: "admin@devhubone.local" },
        action: "event.created",
        targetType: "EventSeries",
        targetId: "series-1",
        metadata: { titleEn: "Workshop" },
        createdAt: new Date("2026-07-20T12:00:00.000Z"),
      },
    ]);
    const prisma = { auditLog: { findMany } } as never;
    const service = new AuditService(prisma);

    const entries = await service.findRecent();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { email: true } } },
      }),
    );
    const cutoff = findMany.mock.calls[0][0].where.createdAt.gte as Date;
    expect(Date.now() - cutoff.getTime()).toBeCloseTo(SEVEN_DAYS_MS, -3);
    expect(entries[0]).toMatchObject({
      id: "log-1",
      actorEmail: "admin@devhubone.local",
      createdAt: "2026-07-20T12:00:00.000Z",
    });
  });
});

describe("AuditService.deleteExpired", () => {
  it("deletes only entries older than the retention window and returns the count", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { auditLog: { deleteMany } } as never;
    const service = new AuditService(prisma);

    await expect(service.deleteExpired()).resolves.toBe(3);

    const cutoff = deleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    expect(Date.now() - cutoff.getTime()).toBeCloseTo(SEVEN_DAYS_MS, -3);
  });
});
