import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NewsletterService, ReaderService } from './reader.service';
import { Public } from '../../common/decorators/public.decorator';

class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(10) preferredLanguage?: string;
}
class PreferencesDto {
  @IsOptional() @IsArray() @IsString({ each: true }) categoryIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) locationIds?: string[];
  @IsOptional() @IsBoolean() breakingNews?: boolean;
  @IsOptional() @IsBoolean() categoryNews?: boolean;
  @IsOptional() @IsBoolean() locationNews?: boolean;
}

@Controller('reader')
@UseGuards(JwtAuthGuard)
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Get('me') getProfile(@CurrentUser('userId') userId: string) { return this.readerService.getProfile(userId); }
  @Patch('me') updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) { return this.readerService.updateProfile(userId, dto); }
  @Patch('preferences') updatePreferences(@CurrentUser('userId') userId: string, @Body() dto: PreferencesDto) { return this.readerService.updatePreferences(userId, dto); }
  @Get('feed') feed(@CurrentUser('userId') userId: string, @Query('limit') limit?: string) { return this.readerService.getFeed(userId, limit ? parseInt(limit, 10) : 20); }
  @Post('bookmarks/:articleId') bookmark(@CurrentUser('userId') userId: string, @Param('articleId') articleId: string) { return this.readerService.addBookmark(userId, articleId); }
  @Delete('bookmarks/:articleId') removeBookmark(@CurrentUser('userId') userId: string, @Param('articleId') articleId: string) { return this.readerService.removeBookmark(userId, articleId); }
  @Get('bookmarks') bookmarks(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getBookmarks(userId, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20); }
  @Get('notifications') notifications(@CurrentUser('userId') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.readerService.getNotifications(userId, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 20); }
  @Patch('notifications/:id/read') read(@CurrentUser('userId') userId: string, @Param('id') id: string) { return this.readerService.markNotificationRead(userId, id); }
  @Post('notifications/read-all') readAll(@CurrentUser('userId') userId: string) { return this.readerService.markAllNotificationsRead(userId); }
}

class NewsletterDto { @IsEmail() email!: string; }
@Controller('public/newsletter')
export class NewsletterController {
  constructor(private readonly readerService: NewsletterService) {}
  @Public() @Post('subscribe') subscribe(@Body() dto: NewsletterDto) { return this.readerService.subscribe(dto.email); }
  @Public() @Post('unsubscribe') unsubscribe(@Body() dto: NewsletterDto) { return this.readerService.unsubscribe(dto.email); }
}
