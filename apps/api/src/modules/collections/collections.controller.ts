import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CollectionsService } from './collections.service';

class CollectionDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(2) @MaxLength(160) slug!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() coverImageId?: string;
  @IsOptional() @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) articleIds?: string[];
}

@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}
  @Get() @RequirePermissions('collection.manage') findAll(@Query('status') status?: string) { return this.service.findAll(status); }
  @Post() @RequirePermissions('collection.manage') create(@Body() dto: CollectionDto, @CurrentUser('userId') userId: string) { return this.service.create(dto, userId); }
  @Patch(':id') @RequirePermissions('collection.manage') update(@Param('id') id: string, @Body() dto: CollectionDto) { return this.service.update(id, dto); }
  @Delete(':id') @RequirePermissions('collection.manage') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Controller('public/collections')
export class PublicCollectionsController {
  constructor(private readonly service: CollectionsService) {}
  @Public() @Get() findAll() { return this.service.publicList(); }
  @Public() @Get(':slug') findOne(@Param('slug') slug: string) { return this.service.publicOne(slug); }
  @Public() @Get(':slug/articles') articles(@Param('slug') slug: string) { return this.service.publicOne(slug); }
}
