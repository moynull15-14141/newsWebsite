import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateEmployerDto, UpdateEmployerDto } from './dto/employer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

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
}
