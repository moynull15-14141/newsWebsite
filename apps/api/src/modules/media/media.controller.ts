import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { QueryMediaDto } from './dto/query-media.dto';
import { CreatePresignedUploadDto } from './dto/create-presigned-upload.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @RequirePermissions('media.upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)),
  }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @Body() body: UploadMediaDto,
  ) {
    return this.mediaService.upload(file, userId, body);
  }

  @Post('upload/presign')
  @RequirePermissions('media.upload')
  presign(@Body() dto: CreatePresignedUploadDto, @CurrentUser('userId') userId: string) {
    return this.mediaService.createPresignedUpload(dto, userId);
  }

  @Get('orphans')
  @RequirePermissions('media.manage')
  orphans(@Query('graceHours') graceHours?: string) {
    return this.mediaService.findOrphanCandidates(graceHours ? parseInt(graceHours, 10) : undefined);
  }

  @Get()
  @RequirePermissions('media.upload')
  findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query.page, query.limit, query.search, query.mimeType, query.status, query.uploadedById);
  }

  @Get(':id')
  @RequirePermissions('media.upload')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Post(':id/complete')
  @RequirePermissions('media.upload')
  complete(@Param('id') id: string, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.mediaService.completeUpload(id, userId, req.user?.permissions || []);
  }

  @Post(':id/replace')
  @RequirePermissions('media.upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_request, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)),
  }))
  replace(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser('userId') userId: string, @Req() req: any) {
    return this.mediaService.replace(id, file, userId, req.user?.permissions || []);
  }

  @Patch(':id')
  @RequirePermissions('media.manage')
  update(@Param('id') id: string, @Body() dto: UpdateMediaDto, @CurrentUser('userId') userId: string) {
    return this.mediaService.update(id, dto, userId);
  }

  @Delete(':id')
  @RequirePermissions('media.manage')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
