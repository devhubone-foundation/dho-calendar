import { Controller, Get, Query } from "@nestjs/common";
import { type DateRangeQuery, dateRangeQuerySchema, type PublicCalendarResponse } from "@dho/contracts";

import { Public } from "../common/decorators/public.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PublicCalendarService } from "./public-calendar.service";

/** GET /api/public/calendar — the only calendar surface a public visitor or
 * the iframe reaches; no authentication, and the service composing this
 * response returns exclusively public fields (PRODUCT_BLUEPRINT.md §17). */
@Controller("public/calendar")
@Public()
export class PublicCalendarController {
  constructor(private readonly publicCalendar: PublicCalendarService) {}

  @Get()
  get(
    @Query(new ZodValidationPipe(dateRangeQuerySchema)) query: DateRangeQuery,
  ): Promise<PublicCalendarResponse> {
    return this.publicCalendar.getCalendar(query.from, query.to);
  }
}
