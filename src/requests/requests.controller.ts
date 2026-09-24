import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { RequestsService } from "./requests.service";
import {
  CreateRequestDto,
  CreateRequestInput,
  createRequestSchema,
  ReviewRequestDto,
  ReviewRequestInput,
  reviewRequestSchema,
} from "./requests.schemas";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("requests")
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get("categories")
  @ResponseMessage("Requests categories fetched successfully")
  categories() {
    return this.requestsService.categories();
  }

  @Post()
  @ResponseMessage("Request created successfully")
  @ApiBody({ type: CreateRequestDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRequestSchema)) dto: CreateRequestInput,
  ) {
    return this.requestsService.create(user.id, dto);
  }

  @Get("me")
  @ResponseMessage("User requests retrieved successfully")
  findOwn(@CurrentUser() user: AuthUser) {
    return this.requestsService.findOwn(user.id);
  }

  @Get()
  @ResponseMessage("All requests fetched successfully")
  @RequirePermissions("requests:view_all")
  findAll() {
    return this.requestsService.findAll();
  }

  @Patch(":id/review")
  @ResponseMessage("Request updated successfully")
  @RequirePermissions("requests:approve")
  @ApiBody({ type: ReviewRequestDto })
  review(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reviewRequestSchema)) dto: ReviewRequestInput,
  ) {
    return this.requestsService.review(id, user.id, dto);
  }

  @Patch(":id/cancel")
  @ResponseMessage("Request cancelled successfully")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.requestsService.cancel(id, user.id);
  }
}
