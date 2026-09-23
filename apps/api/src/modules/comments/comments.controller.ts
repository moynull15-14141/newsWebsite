import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { parsePage, parsePositiveInt, DEFAULT_LIMIT, MAX_LIMIT } from '../../common/pagination/parse-pagination';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.moderate')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('articleId') articleId?: string,
    @Query('search') search?: string,
  ) {
    return this.commentsService.findAll(
      parsePage(page),
      parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT),
      status as any,
      articleId,
      search,
    );
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.moderate')
  getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.commentsService.getReports(
      parsePage(page),
      parsePositiveInt(limit, DEFAULT_LIMIT, MAX_LIMIT),
      status,
    );
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.moderate')
  approve(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.commentsService.moderate(id, 'APPROVED', userId);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.moderate')
  reject(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.commentsService.moderate(id, 'REJECTED', userId);
  }

  @Patch(':id/spam')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.moderate')
  spam(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.commentsService.moderate(id, 'SPAM', userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('comment.delete')
  remove(@Param('id') id: string) {
    return this.commentsService.remove(id);
  }
}
