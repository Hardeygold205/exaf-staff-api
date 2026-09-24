import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ScreentimeService } from "./screentime.service";
import {
  LogScreentimeDto,
  LogScreentimeInput,
  logScreentimeSchema,
  QueryScreentimeInput,
  queryScreentimeSchema,
} from "./screentime.schemas";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Screentime")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("screentime")
export class ScreentimeController {
  constructor(private screentimeService: ScreentimeService) {}

  @Post("log")
  @ResponseMessage("Screentime log created successfully")
  @ApiBody({ type: LogScreentimeDto })
  logScreentime(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(logScreentimeSchema)) dto: LogScreentimeInput,
  ) {
    return this.screentimeService.logScreentime(user.id, dto);
  }

  @Get("me")
  @ResponseMessage("User screentime retrieved successfully")
  findOwnScreentime(
    @CurrentUser() user: AuthUser,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.screentimeService.findOwnScreentime(
      user.id,
      startDate,
      endDate,
    );
  }

  @Get()
  @ResponseMessage("Screentime fetched successfully")
  @RequirePermissions("screentime:view_all")
  findAllScreentime(
    @Query(new ZodValidationPipe(queryScreentimeSchema))
    query: QueryScreentimeInput,
  ) {
    return this.screentimeService.findAllScreentime(query);
  }
}
