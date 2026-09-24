import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
  MonthlyCalendarQuery,
  monthlyCalendarQuerySchema,
} from "./calendar.schemas";
import { CalendarService } from "./calendar.service";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Calendar")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get("monthly")
  @ResponseMessage("Monthly calender fetched successfully")
  @ApiQuery({ name: "year", required: false, type: Number, example: 2026 })
  @ApiQuery({ name: "month", required: false, type: Number, example: 9 })
  getMonthly(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(monthlyCalendarQuerySchema))
    query: MonthlyCalendarQuery,
  ) {
    return this.calendarService.getMonthlyCalendar(user.id, query);
  }
}
