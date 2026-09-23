import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicJobQueryDto } from './dto/public-job-query.dto';
import { publicJobWhere, jobIneligibleReason } from './job-eligibility';
import { loadLocationDescendants } from '../../common/location/location-descendants';

const PUBLIC_JOB_LIST_SELECT = {
  id: true, title: true, slug: true, summary: true, employmentType: true, workplaceType: true,
  salaryMin: true, salaryMax: true, salaryCurrency: true, salaryNegotiable: true, deadline: true,
  publishedAt: true, featured: true, vacancies: true,
  category: { select: { id: true, name: true, slug: true } },
  employer: { select: { id: true, name: true, slug: true, logo: { select: { publicUrl: true, altText: true } } } },
  location: { select: { id: true, name: true, slug: true } },
} as const;

@Injectable()
export class PublicJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async getJobs(query: PublicJobQueryDto, extraWhere: any = {}) {
    const { page = 1, limit = 20, search, category, location, employer, employmentType, workplaceType, sort = 'publishedAt', order = 'desc' } = query;
    const skip = (page - 1) * limit;
    const now = new Date();
    const where: any = { ...publicJobWhere(now), ...extraWhere };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { employer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (category) where.category = { slug: category };
    if (employer) where.employer = { slug: employer };
    if (employmentType) where.employmentType = employmentType;
    if (workplaceType) where.workplaceType = workplaceType;
    if (location) {
      const root = await this.prisma.location.findFirst({ where: { slug: location }, select: { id: true } });
      if (root) {
        const ids = await loadLocationDescendants(this.prisma, [root.id]);
        where.locationId = { in: ids };
      } else {
        where.locationId = '__none__';
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({ where, skip, take: limit, orderBy: [{ featured: 'desc' }, { [sort]: order }], select: PUBLIC_JOB_LIST_SELECT }),
      this.prisma.job.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getFeaturedJobs(limit = 6) {
    const now = new Date();
    return this.prisma.job.findMany({
      where: { ...publicJobWhere(now), featured: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: PUBLIC_JOB_LIST_SELECT,
    });
  }

  async getDeadlineNearJobs(limit = 6) {
    const now = new Date();
    return this.prisma.job.findMany({
      where: { ...publicJobWhere(now), deadline: { not: null } },
      orderBy: { deadline: 'asc' },
      take: limit,
      select: PUBLIC_JOB_LIST_SELECT,
    });
  }

  async getJobBySlug(slug: string) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: {
        category: true,
        employer: { include: { logo: true, location: true } },
        location: true,
      },
    });
    const reason = jobIneligibleReason(job as any);
    if (reason) throw new NotFoundException('Job not found');

    // Fire-and-forget style view increment — a lost increment under concurrent requests is an
    // acceptable trade-off for not blocking the response on it, same posture as article views.
    this.prisma.job.update({ where: { id: job!.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

    const related = await this.prisma.job.findMany({
      where: { ...publicJobWhere(), id: { not: job!.id }, categoryId: job!.categoryId },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: PUBLIC_JOB_LIST_SELECT,
    });

    return { ...job, related };
  }

  async getCategories() {
    return this.prisma.jobCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, description: true },
    });
  }
}
