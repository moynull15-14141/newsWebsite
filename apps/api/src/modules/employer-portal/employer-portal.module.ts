import { Module } from '@nestjs/common';
import { EmployerPortalController } from './employer-portal.controller';
import { EmployerPortalService } from './employer-portal.service';
import { JobsModule } from '../jobs/jobs.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [JobsModule, PlatformSettingsModule],
  controllers: [EmployerPortalController],
  providers: [EmployerPortalService],
})
export class EmployerPortalModule {}
