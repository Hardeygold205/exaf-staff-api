import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MailModule } from "../infra/mail/mail.module";
import { ActivitiesModule } from "../activities/activities.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebsocketModule } from "../infra/socket/events.module";

@Module({
  imports: [MailModule, ActivitiesModule, NotificationsModule, WebsocketModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
