import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdatePlatformSettingDto } from './dto/update-platform-setting.dto';
import { isKnownPlatformSettingKey } from './platform-settings.constants';

@Controller('platform-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  @RequirePermissions('platform.settings.view')
  getAll() {
    return this.platformSettingsService.getAll();
  }

  @Patch(':key')
  @RequirePermissions('platform.settings.manage')
  update(@Param('key') key: string, @Body() dto: UpdatePlatformSettingDto, @CurrentUser('userId') userId: string) {
    if (!isKnownPlatformSettingKey(key)) {
      throw new BadRequestException(`Unknown platform setting key: ${key}`);
    }
    return this.platformSettingsService.set(key, dto.value, userId);
  }
}
