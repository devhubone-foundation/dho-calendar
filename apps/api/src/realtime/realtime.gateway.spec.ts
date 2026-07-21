import { DomainEventsService } from "../common/domain-events/domain-events.service";
import { RealtimeGateway } from "./realtime.gateway";

describe("RealtimeGateway", () => {
  it("broadcasts every domain-event payload verbatim to all connected clients", () => {
    const domainEvents = new DomainEventsService();
    const gateway = new RealtimeGateway(domainEvents);
    gateway.server = { emit: jest.fn() } as never;

    gateway.onModuleInit();

    domainEvents.emit("office-schedule.changed", { from: "2026-07-20", to: "2026-07-21" });
    domainEvents.emit("attendance.changed", { userId: "user-1", from: "2026-07-20", to: "2026-07-20" });
    domainEvents.emit("event.changed", { seriesId: "series-1" });
    domainEvents.emit("profile.changed", { userId: "user-2" });
    domainEvents.emit("member-status.changed", { userId: "user-3" });

    expect(gateway.server.emit).toHaveBeenCalledWith("office-schedule.changed", {
      from: "2026-07-20",
      to: "2026-07-21",
    });
    expect(gateway.server.emit).toHaveBeenCalledWith("attendance.changed", {
      userId: "user-1",
      from: "2026-07-20",
      to: "2026-07-20",
    });
    expect(gateway.server.emit).toHaveBeenCalledWith("event.changed", { seriesId: "series-1" });
    expect(gateway.server.emit).toHaveBeenCalledWith("profile.changed", { userId: "user-2" });
    expect(gateway.server.emit).toHaveBeenCalledWith("member-status.changed", { userId: "user-3" });
    expect(gateway.server.emit).toHaveBeenCalledTimes(5);
  });

  it("never broadcasts a payload containing display fields beyond the documented entity references", () => {
    const domainEvents = new DomainEventsService();
    const gateway = new RealtimeGateway(domainEvents);
    const emitted: unknown[] = [];
    gateway.server = { emit: (_event: string, payload: unknown) => emitted.push(payload) } as never;

    gateway.onModuleInit();
    domainEvents.emit("profile.changed", { userId: "user-2" });

    expect(emitted).toEqual([{ userId: "user-2" }]);
  });
});
