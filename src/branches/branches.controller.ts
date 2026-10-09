import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { BranchesService } from "./branches.service";
import {
  CreateBranchDto,
  CreateBranchInput,
  createBranchSchema,
  UpdateBranchDto,
  UpdateBranchInput,
  updateBranchSchema,
} from "./branches.schemas";

@ApiTags("Branches")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("branches")
export class BranchesController {
  constructor(private branches: BranchesService) {}

  @Post()
  @ResponseMessage("Branch created successfully")
  @RequirePermissions("branches:manage")
  @ApiBody({ type: CreateBranchDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchInput,
  ) {
    return this.branches.create(user, dto);
  }

  @Get()
  @ResponseMessage("Branches retrieved successfully")
  @RequirePermissions("branches:view")
  findAll(@CurrentUser() user: AuthUser) {
    return this.branches.findAll(user);
  }

  @Patch(":id")
  @ResponseMessage("Branch updated successfully")
  @RequirePermissions("branches:manage")
  @ApiBody({ type: UpdateBranchDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) dto: UpdateBranchInput,
  ) {
    return this.branches.update(user, id, dto);
  }

  @Patch(":id/deactivate")
  @ResponseMessage("Branch deactivated successfully")
  @RequirePermissions("branches:manage")
  deactivate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.branches.deactivate(user, id);
  }
}
