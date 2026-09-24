import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdPlacementsService } from './services/ad-placements.service';
import { UpdatePlacementDto } from './dto/update-placement.dto';
import { AssignPlacementDto, UpdateCampaignPlacementDto } from './dto/assign-placement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('ad-placements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdPlacementsController {
  constructor(private readonly placements: AdPlacementsService) {}

  @Get()
  @RequirePermissions('ads.view')
  findAll() {
    return this.placements.findAll();
  }

  @Get(':id')
  @RequirePermissions('ads.view')
  findOne(@Param('id') id: string) {
    return this.placements.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('ads.placement.manage')
  setEnabled(@Param('id') id: string, @Body() dto: UpdatePlacementDto, @CurrentUser('userId') userId: string) {
    return this.placements.setEnabled(id, dto.enabled, userId);
  }

  @Post('assignments')
  @RequirePermissions('ads.placement.manage')
  assign(@Body() dto: AssignPlacementDto, @CurrentUser('userId') userId: string) {
    return this.placements.assign(dto.campaignId, dto.placementId, dto.priority, dto.enabled, userId);
  }

  @Patch('assignments/:assignmentId')
  @RequirePermissions('ads.placement.manage')
  updateAssignment(@Param('assignmentId') assignmentId: string, @Body() dto: UpdateCampaignPlacementDto, @CurrentUser('userId') userId: string) {
    return this.placements.updateAssignment(assignmentId, dto, userId);
  }

  @Delete('assignments/:assignmentId')
  @RequirePermissions('ads.placement.manage')
  removeAssignment(@Param('assignmentId') assignmentId: string, @CurrentUser('userId') userId: string) {
    return this.placements.removeAssignment(assignmentId, userId);
  }
}
