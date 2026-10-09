import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { requireOrgId } from "../common/tenant";
import { EventsService } from "./events.service";
import {
  CreateEventDto,
  CreateEventInput,
  createEventSchema,
  UpdateEventDto,
  UpdateEventInput,
  updateEventSchema,
} from "./events.schemas";

@ApiTags("Events")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("events")
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get("upcoming")
  @ResponseMessage("Upcoming events retrieved successfully")
  upcoming(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    const parsed = days ? Number(days) : 30;
    const safeDays = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), 1), 365)
      : 30;
    return this.eventsService.listUpcoming(requireOrgId(user), safeDays);
  }

  @Get()
  @ResponseMessage("Managed events retrieved successfully")
  @RequirePermissions("events:manage")
  listManaged(@CurrentUser() user: AuthUser) {
    return this.eventsService.listManaged(requireOrgId(user));
  }

  @Get(":id")
  @ResponseMessage("Event retrieved successfully")
  findOne(@Param("id") id: string) {
    return this.eventsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Event created successfully")
  @RequirePermissions("events:manage")
  @ApiBody({ type: CreateEventDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createEventSchema)) dto: CreateEventInput,
  ) {
    return this.eventsService.create(user.id, dto);
  }

  @Patch(":id")
  @ResponseMessage("Event updated successfully")
  @RequirePermissions("events:manage")
  @ApiBody({ type: UpdateEventDto })
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateEventSchema)) dto: UpdateEventInput,
  ) {
    return this.eventsService.update(id, user.id, dto);
  }

  @Delete(":id")
  @ResponseMessage("Event deleted successfully")
  @RequirePermissions("events:manage")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.remove(id, user.id);
  }
}
