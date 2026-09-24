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
import {
  CreateSuggestionDto,
  CreateSuggestionInput,
  createSuggestionSchema,
  UpdateSuggestionStatusDto,
  UpdateSuggestionStatusInput,
  updateSuggestionStatusSchema,
  VoteSuggestionDto,
  VoteSuggestionInput,
  voteSuggestionSchema,
} from "./suggestions.schemas";
import { SuggestionsService } from "./suggestions.service";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Suggestions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("suggestions")
export class SuggestionsController {
  constructor(private suggestionsService: SuggestionsService) {}

  @Get()
  @ResponseMessage("Suggestions fetched successfully")
  findAll(@CurrentUser() user: AuthUser) {
    return this.suggestionsService.findAll(user.id);
  }

  @Post()
  @ResponseMessage("Suggestions created successfully")
  @ApiBody({ type: CreateSuggestionDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSuggestionSchema))
    dto: CreateSuggestionInput,
  ) {
    return this.suggestionsService.create(user.id, dto);
  }

  @Post(":id/vote")
  @ResponseMessage("Suggestions vote successfully created")
  @ApiBody({ type: VoteSuggestionDto })
  vote(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(voteSuggestionSchema)) dto: VoteSuggestionInput,
  ) {
    return this.suggestionsService.vote(user.id, id, dto);
  }

  @Patch(":id/status")
  @ResponseMessage("Suggestions updated successfully")
  @RequirePermissions("suggestions:manage")
  @ApiBody({ type: UpdateSuggestionStatusDto })
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSuggestionStatusSchema))
    dto: UpdateSuggestionStatusInput,
  ) {
    return this.suggestionsService.updateStatus(id, dto);
  }
}
