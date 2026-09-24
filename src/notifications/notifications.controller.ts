import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  AuthUser,
} from "../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";
import {
  QueryNotificationsInput,
  queryNotificationsSchema,
} from "./notifications.schemas";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get("unread-count")
  @ResponseMessage("Notifications unread count retrieved")
  getUnreadCount(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get()
  @ResponseMessage("User notifications fetched successfully")
  findOwn(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(queryNotificationsSchema))
    query: QueryNotificationsInput,
  ) {
    return this.notificationsService.findOwnNotifications(user.id, query);
  }

  @Patch("read-all")
  @ResponseMessage("All user notifications read successfully")
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(":id/read")
  @ResponseMessage("You successfully read a notifications")
  markAsRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}
