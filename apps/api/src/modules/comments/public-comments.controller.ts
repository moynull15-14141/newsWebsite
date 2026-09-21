import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('public')
export class PublicCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Post('articles/:slug/comments')
  create(@Param('slug') slug: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(slug, dto, undefined, dto.guestName);
  }

  @Public()
  @Get('articles/:slug/comments')
  list(@Param('slug') slug: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.commentsService.findByArticle(slug, page ? parseInt(page, 10) : 1, limit ? parseInt(limit, 10) : 50);
  }

  @Public()
  @Post('comments/:id/report')
  report(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.commentsService.report(id, (reason || 'Other').slice(0, 200));
  }
}
