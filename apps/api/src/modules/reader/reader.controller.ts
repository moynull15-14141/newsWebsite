import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NewsletterService, ReaderService } from './reader.service';
import { Public } from '../../common/decorators/public.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';
import { MediaService } from '../media/media.service';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(10) preferredLanguage?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 -]{7,20}$/) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsIn(['LIGHT', 'DARK', 'SYSTEM']) theme?: string;
  @IsOptional() @IsBoolean() profilePublic?: boolean;
}
class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
class PreferencesDto {
  @IsOptional() @IsArray() @IsString({ each: true }) categoryIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) locationIds?: string[];
  @IsOptional() @IsBoolean() breakingNews?: boolean;
  @IsOptional() @IsBoolean() categoryNews?: boolean;
  @IsOptional() @IsBoolean() locationNews?: boolean;
  @IsOptional() @IsBoolean() jobAlerts?: boolean;
  @IsOptional() @IsBoolean() accountSecurity?: boolean;
}
class ApplyToJobDto {
  @IsOptional() @IsString() resumeId?: string;
  @IsOptional() @IsString() @MaxLength(5000) coverLetter?: string;
}

@Controller('reader')
@UseGuards(JwtAuthGuard)
export class ReaderController {
  constructor(private readonly readerService: ReaderService, private readonly mediaService: MediaService) {}

  @Get('me') getProfile(@CurrentUser('userId') userId: string) { return this.readerService.getProfile(userId); }
  @Patch('me') updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) { return this.readerService.updateProfile(userId, dto); }
  @Patch('me/password') changePassword(@CurrentUser('userId') userId: string, @Body() dto: ChangePasswordDto) { return this.readerService.changePassword(userId, dto.currentPassword, dto.newPassword); }
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) }))
  async avatar(@CurrentUser('userId') userId: string, @UploadedFile() file: Express.Multer.File) {
    const media = await this.mediaService.upload(file, userId, { altText: 'Profile avatar' });
    return this.readerService.setAvatar(userId, media.id);
  }
  @Patch('preferences') updatePreferences(@CurrentUser('userId') userId: string, @Body() dto: PreferencesDto) { return this.readerService.updatePreferences(userId, dto); }
  @Get('feed') feed(@CurrentUser('userId') userId: string, @Query('limit') limit?: string) { return this.readerService.getFeed(userId, parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT)); }
  @Post('bookmarks/:articleId') bookmark(@CurrentUser('userId') userId: string, @Param('articleId') articleId: string) { return this.readerService.addBookmark(userId, articleId); }
  @Get('bookmarks/:articleId') bookmarkState(@CurrentUser('userId') userId: string, @Param('articleId') articleId: string) { return this.readerService.bookmarkStatus(userId, articleId); }
  @Delete('bookmarks/:articleId') removeBookmark(@CurrentUser('userId') userId: string, @Param('articleId') articleId: string) { return this.readerService.removeBookmark(userId, articleId); }
  @Get('bookmarks') bookmarks(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getBookmarks(userId, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT)); }
  @Get('notifications') notifications(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getNotifications(userId, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT)); }
  @Patch('notifications/:id/read') read(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.markNotificationRead(userId, id); }
  @Post('notifications/read-all') readAll(@CurrentUser('userId') userId: string) { return this.readerService.markAllNotificationsRead(userId); }

  // ==================== SAVED JOBS (Phase 2O) ====================
  @Post('saved-jobs/:jobId') saveJob(@CurrentUser('userId') userId: string, @Param('jobId') jobId: string) { return this.readerService.addSavedJob(userId, jobId); }
  @Get('saved-jobs/:jobId') savedJobState(@CurrentUser('userId') userId: string, @Param('jobId') jobId: string) { return this.readerService.savedJobStatus(userId, jobId); }
  @Delete('saved-jobs/:jobId') unsaveJob(@CurrentUser('userId') userId: string, @Param('jobId') jobId: string) { return this.readerService.removeSavedJob(userId, jobId); }
  @Get('saved-jobs') savedJobs(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getSavedJobs(userId, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT)); }

  // ==================== RESUMES (Phase 2O) ====================
  @Get('resumes') resumes(@CurrentUser('userId') userId: string) { return this.readerService.listResumes(userId); }
  @Post('resumes')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadResume(@CurrentUser('userId') userId: string, @UploadedFile() file: Express.Multer.File) { return this.readerService.uploadResume(userId, file); }
  @Patch('resumes/:id/default') setDefaultResume(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.setDefaultResume(userId, id); }
  @Delete('resumes/:id') deleteResume(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.deleteResume(userId, id); }

  // ==================== JOB APPLICATIONS (Phase 2O, applicant side) ====================
  @Post('job-applications/:jobId') apply(@CurrentUser('userId') userId: string, @Param('jobId') jobId: string, @Body() dto: ApplyToJobDto) { return this.readerService.applyToJob(userId, jobId, dto); }
  @Get('job-applications') myApplications(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getMyApplications(userId, parsePage(page), parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT)); }
  @Get('job-applications/:id') myApplication(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.getMyApplication(userId, id); }
  @Post('job-applications/:id/withdraw') withdraw(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.withdrawApplication(userId, id); }
}

class NewsletterDto { @IsEmail() email!: string; }
@Controller('public/newsletter')
export class NewsletterController {
  constructor(private readonly readerService: NewsletterService) {}
  @Public() @Post('subscribe') subscribe(@Body() dto: NewsletterDto) { return this.readerService.subscribe(dto.email); }
  @Public() @Post('unsubscribe') unsubscribe(@Body() dto: NewsletterDto) { return this.readerService.unsubscribe(dto.email); }
}
