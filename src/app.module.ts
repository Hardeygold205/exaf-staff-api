import { Module } from "@nestjs/common";
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { RedisModule } from "./infra/redis/redis.module";
import { MailModule } from "./infra/mail/mail.module";
import { StorageModule } from "./infra/storage/storage.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RolesModule } from "./roles/roles.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { ProjectsModule } from "./projects/projects.module";
import { RequestsModule } from "./requests/requests.module";
import { ScreentimeModule } from "./screentime/screentime.module";
import { ActivitiesModule } from "./activities/activities.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { UploadsModule } from "./uploads/uploads.module";
import { TasksModule } from "./tasks/tasks.module";
import { EventsModule } from "./events/events.module";
import { CalendarModule } from "./calendar/calendar.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";
import { WebsocketModule } from "./infra/socket/events.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    PrismaModule,
    RedisModule,
    MailModule,
    StorageModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AttendanceModule,
    ProjectsModule,
    RequestsModule,
    ScreentimeModule,
    ActivitiesModule,
    NotificationsModule,
    UploadsModule,
    TasksModule,
    EventsModule,
    CalendarModule,
    SuggestionsModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
