import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';
import { EmployerPortalService } from './employer-portal.service';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateEmployerJobDto, UpdateEmployerJobDto } from './dto/employer-job.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';
import { CreateOrderDto } from './dto/order.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

// Ownership-scoped, NOT RBAC — no RolesGuard/@RequirePermissions here (see reader.controller.ts for the
// same pattern). Every handler below resolves "whose data is this" from the caller's own
// EmployerMembership row inside EmployerPortalService, never from a client-supplied employerId.
//
// CRITICAL: this controller never imports/exposes JobsService.publish/approve/schedule — an employer can
// create, edit (while DRAFT), submit, withdraw and archive their own jobs, but can never move a job to
// APPROVED/SCHEDULED/PUBLISHED themselves. That stays admin-only (see JobsController).
@Controller('employer-portal')
@UseGuards(JwtAuthGuard)
export class EmployerPortalController {
  constructor(private readonly employerPortalService: EmployerPortalService) {}

  // ==================== REGISTRATION / ME / COMPANY ====================

  @Post('register')
  register(@CurrentUser('userId') userId: string, @Body() dto: RegisterEmployerDto) {
    return this.employerPortalService.register(userId, dto);
  }

  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.employerPortalService.getMyMemberships(userId);
  }

  @Get('company')
  getCompany(@CurrentUser('userId') userId: string) {
    return this.employerPortalService.getCompany(userId);
  }

  @Patch('company')
  updateCompany(@CurrentUser('userId') userId: string, @Body() dto: UpdateCompanyDto) {
    return this.employerPortalService.updateCompany(userId, dto);
  }

  @Post('company/submit-verification')
  submitVerification(@CurrentUser('userId') userId: string) {
    return this.employerPortalService.submitVerification(userId);
  }

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  dashboard(@CurrentUser('userId') userId: string) {
    return this.employerPortalService.getDashboard(userId);
  }

  // ==================== JOBS ====================

  @Get('jobs')
  listJobs(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.employerPortalService.listJobs(userId, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), status);
  }

  @Post('jobs')
  createJob(@CurrentUser('userId') userId: string, @Body() dto: CreateEmployerJobDto) {
    return this.employerPortalService.createJob(userId, dto);
  }

  @Get('jobs/:id')
  getJob(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.employerPortalService.getJob(userId, id);
  }

  @Patch('jobs/:id')
  updateJob(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdateEmployerJobDto) {
    return this.employerPortalService.updateJob(userId, id, dto);
  }

  @Post('jobs/:id/submit')
  submitJob(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.employerPortalService.submitJob(userId, id);
  }

  @Post('jobs/:id/withdraw')
  withdrawJob(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.employerPortalService.withdrawJob(userId, id);
  }

  @Post('jobs/:id/archive')
  archiveJob(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.employerPortalService.archiveJob(userId, id);
  }

  @Post('jobs/:id/orders')
  createOrder(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: CreateOrderDto) {
    return this.employerPortalService.createOrder(userId, id, dto.planId);
  }

  // ==================== APPLICATIONS ====================

  @Get('applications')
  listApplications(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
  ) {
    return this.employerPortalService.listApplications(userId, {
      page: parsePage(page), limit: parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT), jobId, status,
    });
  }

  @Get('applications/:id')
  getApplication(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.employerPortalService.getApplication(userId, id);
  }

  @Patch('applications/:id/status')
  updateApplicationStatus(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() dto: UpdateApplicationStatusDto) {
    return this.employerPortalService.updateApplicationStatus(userId, id, dto.status, dto.note);
  }

  // ==================== MEMBERS ====================

  @Get('members')
  listMembers(@CurrentUser('userId') userId: string) {
    return this.employerPortalService.listMembers(userId);
  }

  @Post('members')
  inviteMember(@CurrentUser('userId') userId: string, @Body() dto: InviteMemberDto) {
    return this.employerPortalService.inviteMember(userId, dto);
  }

  @Post('members/accept/:membershipId')
  acceptInvite(@CurrentUser('userId') userId: string, @Param('membershipId') membershipId: string) {
    return this.employerPortalService.acceptInvite(userId, membershipId);
  }

  @Patch('members/:membershipId')
  updateMemberRole(@CurrentUser('userId') userId: string, @Param('membershipId') membershipId: string, @Body() dto: UpdateMemberRoleDto) {
    return this.employerPortalService.updateMemberRole(userId, membershipId, dto);
  }

  @Delete('members/:membershipId')
  removeMember(@CurrentUser('userId') userId: string, @Param('membershipId') membershipId: string) {
    return this.employerPortalService.removeMember(userId, membershipId);
  }

  // ==================== PLANS ====================

  @Get('plans')
  listPlans() {
    return this.employerPortalService.listPlans();
  }
}
