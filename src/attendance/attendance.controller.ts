import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { AttendanceService } from "./attendance.service";
import { requireOrgId } from "../common/tenant";
import {
  CheckInDto,
  CheckInInput,
  checkInSchema,
  CheckOutDto,
  CheckOutInput,
  checkOutSchema,
  ReviewAttendanceDto,
  ReviewAttendanceInput,
  reviewAttendanceSchema,
} from "./attendance.schemas";

@ApiTags("Attendance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("attendance")
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get("checkout-reasons")
  @ResponseMessage("Checkout reasons retrieved successfully")
  checkoutReasons() {
    return this.attendanceService.checkoutReasons();
  }

  @Post("check-in")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Checked in successfully")
  @ApiBody({ type: CheckInDto })
  checkIn(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkInSchema)) dto: CheckInInput,
    @Req() req: Request,
  ) {
    return this.attendanceService.checkIn(user.id, dto, req.ip);
  }

  @Post("check-out")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Checked out successfully")
  @ApiBody({ type: CheckOutDto })
  checkOut(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(checkOutSchema)) dto: CheckOutInput,
    @Req() req: Request,
  ) {
    return this.attendanceService.checkOut(user.id, dto, req.ip);
  }

  @Get("me")
  @ResponseMessage("Attendance records retrieved successfully")
  findOwn(@CurrentUser() user: AuthUser) {
    return this.attendanceService.findOwn(user.id);
  }

  @Get()
  @ResponseMessage("All attendance records retrieved successfully")
  @RequirePermissions("attendance:view_all")
  findAll(@CurrentUser() user: AuthUser) {
    return this.attendanceService.findAll(requireOrgId(user));
  }

  @Get("pending-review")
  @ResponseMessage("Pending attendance reviews retrieved successfully")
  @RequirePermissions("attendance:review")
  findPendingReview() {
    return this.attendanceService.findPendingReview();
  }

  @Patch(":id/review")
  @ResponseMessage("Attendance record reviewed successfully")
  @RequirePermissions("attendance:review")
  @ApiBody({ type: ReviewAttendanceDto })
  review(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(reviewAttendanceSchema))
    dto: ReviewAttendanceInput,
  ) {
    return this.attendanceService.review(id, user.id, dto);
  }
}
