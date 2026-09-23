import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JobsService } from './jobs.service';
import { CreateEmployerDto, UpdateEmployerDto } from './dto/employer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

class VerifyEmployerDto {
  @IsIn(['VERIFIED', 'REJECTED'])
  decision!: 'VERIFIED' | 'REJECTED';

  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

@Controller('employers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployersController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @RequirePermissions('job.read')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('status') status?: string) {
    return this.jobsService.listEmployers(parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), search, status);
  }

  @Get(':id')
  @RequirePermissions('job.read')
  findOne(@Param('id') id: string) {
    return this.jobsService.getEmployer(id);
  }

  @Post()
  @RequirePermissions('job.manage_employers')
  create(@Body() dto: CreateEmployerDto, @CurrentUser('userId') userId: string) {
    return this.jobsService.createEmployer(dto, userId);
  }

  @Patch(':id')
  @RequirePermissions('job.manage_employers')
  update(@Param('id') id: string, @Body() dto: UpdateEmployerDto) {
    return this.jobsService.updateEmployer(id, dto);
  }

  @Patch(':id/verify')
  @RequirePermissions('employer.verify')
  verify(@Param('id') id: string, @Body() dto: VerifyEmployerDto, @CurrentUser('userId') userId: string) {
    return this.jobsService.verifyEmployer(id, dto.decision, dto.note, userId);
  }

  @Patch(':id/suspend')
  @RequirePermissions('employer.suspend')
  suspend(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.suspendEmployer(id, userId);
  }

  @Patch(':id/reactivate')
  @RequirePermissions('employer.suspend')
  reactivate(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.jobsService.reactivateEmployer(id, userId);
  }

  @Get(':id/audit-log')
  @RequirePermissions('job.read')
  auditLog(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.jobsService.getEmployerAuditLog(id, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT));
  }

  @Get(':id/members')
  @RequirePermissions('job.read')
  members(@Param('id') id: string) {
    return this.jobsService.getEmployerMembers(id);
  }
}
