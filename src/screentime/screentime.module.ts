import { Module } from '@nestjs/common';
import { ScreentimeController } from './screentime.controller';
import { ScreentimeService } from './screentime.service';

@Module({
  controllers: [ScreentimeController],
  providers: [ScreentimeService],
  exports: [ScreentimeService],
})
export class ScreentimeModule {}
