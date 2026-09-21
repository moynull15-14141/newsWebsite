import { Module } from '@nestjs/common';
import { ScheduledPublishingScheduler } from './scheduled-publishing.scheduler';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ServicesModule],
  providers: [ScheduledPublishingScheduler],
})
export class SchedulersModule {}
