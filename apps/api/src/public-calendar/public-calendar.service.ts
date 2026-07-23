import { Inject, Injectable } from "@nestjs/common";
import type { ApiEnv } from "@dho/config";
import type {
  AttendanceStatus,
  PublicCalendarDay,
  PublicCalendarResponse,
  PublicMemberAttendance,
} from "@dho/contracts";

import type { ActiveMemberAttendanceDay } from "../attendance/attendance.service";
import { AttendanceService } from "../attendance/attendance.service";
import { clampToHorizon, todayInTimezone } from "../common/calendar-date.util";
import { APP_ENV } from "../config/config.tokens";
import { EventsService } from "../events/events.service";
import { OfficeScheduleService } from "../office-schedule/office-schedule.service";
import { PrismaService } from "../prisma/prisma.service";

type PublicMemberFields = Omit<PublicMemberAttendance, "slots">;

@Injectable()
export class PublicCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officeSchedule: OfficeScheduleService,
    private readonly attendance: AttendanceService,
    private readonly events: EventsService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  /**
   * Composes the public-facing calendar for [from, to] (PRODUCT_BLUEPRINT.md
   * §6.1/§16/§17): effective office state, confirmed/uncertain attendees
   * (public fields only, clamped to office hours), and events. Applies the
   * §13 public open-day rule from the already-clamped attendee view — a day
   * is only "open" publicly when it has at least one visibly confirmed
   * attendee, so `isPublicOpenDay` can never be true with an empty
   * `confirmedAttendees` list. Per §12.8, confirmed attendance on a date the
   * base schedule marks closed overrides that closure: `clampToOfficeHours`
   * already lets such a member's entered slots through unclamped as
   * `publicSlots`, so `confirmedAttendees.length > 0` alone determines
   * openness; the displayed office hours for a day opened this way are the
   * min-start/max-end span across those attendees' slots.
   */
  async getCalendar(from: string, to: string): Promise<PublicCalendarResponse> {
    const today = todayInTimezone(this.env.OFFICE_TIMEZONE);
    const clampedTo = clampToHorizon(to, today);

    const [officeDays, memberDays, eventsResponse, activeMembers] = await Promise.all([
      this.officeSchedule.resolveRange(from, clampedTo),
      this.attendance.resolveActiveMembersForRange(from, clampedTo),
      this.events.listRange(from, clampedTo),
      this.prisma.user.findMany({
        where: { isActive: true },
        include: { profile: true },
      }),
    ]);

    const profileByUserId = new Map<string, PublicMemberFields>();
    for (const user of activeMembers) {
      if (!user.profile) continue;
      profileByUserId.set(user.id, {
        fullName: user.profile.fullName,
        profileImagePath: user.profile.profileImagePath,
        qualificationBg: user.profile.qualificationBg,
        qualificationEn: user.profile.qualificationEn,
        contactEmail: user.email,
      });
    }

    const memberDaysByDate = groupByDate(memberDays);

    const days: PublicCalendarDay[] = officeDays.map((office) => {
      const dayMembers = memberDaysByDate.get(office.date) ?? [];
      const confirmedAttendees = buildAttendeeList(dayMembers, "ATTENDING", profileByUserId);
      const uncertainAttendees = buildAttendeeList(dayMembers, "NOT_SURE", profileByUserId);
      const isPublicOpenDay = confirmedAttendees.length > 0;
      const openedByAttendance = !office.isOpen && isPublicOpenDay;
      const attendanceSpan = openedByAttendance ? spanOfAttendeeSlots(confirmedAttendees) : null;

      return {
        date: office.date,
        office: openedByAttendance
          ? {
              isOpen: true,
              startTime: attendanceSpan?.startTime ?? null,
              endTime: attendanceSpan?.endTime ?? null,
              isChanged: office.source === "EXCEPTION",
            }
          : {
              isOpen: office.isOpen,
              startTime: office.startTime,
              endTime: office.endTime,
              isChanged: office.source === "EXCEPTION",
            },
        isPublicOpenDay,
        confirmedAttendees,
        uncertainAttendees,
      };
    });

    return { range: { from, to: clampedTo }, days, events: eventsResponse.occurrences };
  }
}

function groupByDate(rows: ActiveMemberAttendanceDay[]): Map<string, ActiveMemberAttendanceDay[]> {
  const map = new Map<string, ActiveMemberAttendanceDay[]>();
  for (const row of rows) {
    const list = map.get(row.date);
    if (list) {
      list.push(row);
    } else {
      map.set(row.date, [row]);
    }
  }
  return map;
}

/** Min-start/max-end span of a closed date's confirmed attendees' slots —
 * the office hours shown for a day opened by attendance rather than by the
 * admin schedule (PRODUCT_BLUEPRINT.md §12.8/§13). */
function spanOfAttendeeSlots(attendees: PublicMemberAttendance[]): { startTime: string; endTime: string } | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const attendee of attendees) {
    for (const slot of attendee.slots) {
      if (start === null || slot.startTime < start) start = slot.startTime;
      if (end === null || slot.endTime > end) end = slot.endTime;
    }
  }
  return start !== null && end !== null ? { startTime: start, endTime: end } : null;
}

/** Only members with at least one clamped public slot are listed — a member
 * whose entered slots have zero overlap with office hours has nothing
 * meaningful to publicly display (PRODUCT_BLUEPRINT.md §12.7's clamping
 * policy), so they are excluded from both the visible list and the open-day
 * determination above, keeping the two always consistent. */
function buildAttendeeList(
  dayMembers: ActiveMemberAttendanceDay[],
  status: AttendanceStatus,
  profileByUserId: Map<string, PublicMemberFields>,
): PublicMemberAttendance[] {
  const attendees: PublicMemberAttendance[] = [];
  for (const member of dayMembers) {
    if (member.status !== status || member.publicSlots.length === 0) continue;
    const profile = profileByUserId.get(member.userId);
    if (!profile) continue;
    attendees.push({ ...profile, slots: member.publicSlots });
  }
  return attendees;
}
