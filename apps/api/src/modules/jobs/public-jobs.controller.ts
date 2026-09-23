import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicJobsService } from './public-jobs.service';
import { PublicJobQueryDto } from './dto/public-job-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { parsePositiveInt } from '../../common/pagination/parse-pagination';

@Controller('public')
export class PublicJobsController {
  constructor(private readonly publicJobsService: PublicJobsService) {}

  @Public()
  @Get('jobs')
  getJobs(@Query() query: PublicJobQueryDto) {
    return this.publicJobsService.getJobs(query);
  }

  @Public()
  @Get('jobs/featured')
  getFeatured(@Query('limit') limit?: string) {
    return this.publicJobsService.getFeaturedJobs(parsePositiveInt(limit, 6, 20));
  }

  @Public()
  @Get('jobs/deadline-near')
  getDeadlineNear(@Query('limit') limit?: string) {
    return this.publicJobsService.getDeadlineNearJobs(parsePositiveInt(limit, 6, 20));
  }

  @Public()
  @Get('job-categories')
  getCategories() {
    return this.publicJobsService.getCategories();
  }

  @Public()
  @Get('jobs/:slug')
  getJobBySlug(@Param('slug') slug: string) {
    return this.publicJobsService.getJobBySlug(slug);
  }
}
