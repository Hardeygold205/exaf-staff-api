import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformService } from "./platform.service";
import {
  PlatformActivityQuery,
  PlatformListQuery,
  PlatformSignupsQuery,
  platformActivityQuerySchema,
  platformListQuerySchema,
  platformSignupsQuerySchema,
} from "./platform.schemas";

@ApiTags("Platform")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller("platform")
export class PlatformController {
  constructor(private platform: PlatformService) {}

  @Get("session")
  @ResponseMessage("Platform session retrieved successfully")
  session(@CurrentUser() user: AuthUser) {
    return this.platform.session(user.email);
  }

  @Get("overview")
  @ResponseMessage("Platform overview retrieved successfully")
  overview() {
    return this.platform.overview();
  }

  @Get("organizations")
  @ResponseMessage("Organizations retrieved successfully")
  organizations(
    @Query(new ZodValidationPipe(platformListQuerySchema)) query: PlatformListQuery,
  ) {
    return this.platform.listOrganizations(query);
  }

  @Get("organizations/:id")
  @ResponseMessage("Organization usage retrieved successfully")
  organization(@Param("id") id: string) {
    return this.platform.organization(id);
  }

  @Get("signups")
  @ResponseMessage("Organization signups retrieved successfully")
  signups(
    @Query(new ZodValidationPipe(platformSignupsQuerySchema)) query: PlatformSignupsQuery,
  ) {
    return this.platform.signups(query);
  }

  @Get("activity")
  @ResponseMessage("Platform activity retrieved successfully")
  activity(
    @Query(new ZodValidationPipe(platformActivityQuerySchema)) query: PlatformActivityQuery,
  ) {
    return this.platform.activity(query);
  }
}
