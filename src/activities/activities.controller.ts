import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ActivitiesService } from "./activities.service";
import {
  QueryActivitiesInput,
  queryActivitiesSchema,
} from "./activities.schemas";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { requireOrgId } from "../common/tenant";

@ApiTags("Activities")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("activities")
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Get("me")
  @ResponseMessage("User activities fetched successfully")
  findOwn(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const pageNum =
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitNum =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 20;
    return this.activitiesService.findOwnActivities(user.id, pageNum, limitNum);
  }

  @Get()
  @ResponseMessage("All activities fetched successfully")
  @RequirePermissions("activities:view_all")
  findAll(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(queryActivitiesSchema))
    query: QueryActivitiesInput,
  ) {
    return this.activitiesService.findAllActivities(query, user.isPlatformAdmin ? undefined : requireOrgId(user));
  }
}
