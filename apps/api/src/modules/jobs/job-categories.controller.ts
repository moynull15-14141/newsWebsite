import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobCategoryDto, UpdateJobCategoryDto } from './dto/job-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('job-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobCategoriesController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @RequirePermissions('job.read')
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.jobsService.listCategories(includeInactive === 'true');
  }

  @Post()
  @RequirePermissions('job.manage_categories')
  create(@Body() dto: CreateJobCategoryDto) {
    return this.jobsService.createCategory(dto);
  }

  @Patch(':id')
  @RequirePermissions('job.manage_categories')
  update(@Param('id') id: string, @Body() dto: UpdateJobCategoryDto) {
    return this.jobsService.updateCategory(id, dto);
  }

  // Deliberately no hard DELETE route — see JobsService.deactivateCategory's doc comment. This is the
  // "safe deactivation instead of destructive deletion" Part 7 asks for.
  @Delete(':id')
  @RequirePermissions('job.manage_categories')
  deactivate(@Param('id') id: string) {
    return this.jobsService.deactivateCategory(id);
  }
}
