import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceAutoCheckoutService } from "./attendance-auto-checkout.service";
import { AttendanceController } from './attendance.controller';
import { ActivitiesModule } from '../activities/activities.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivitiesModule, NotificationsModule],
  providers: [AttendanceService, AttendanceAutoCheckoutService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
