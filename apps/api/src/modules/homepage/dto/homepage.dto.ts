import { HomepageSectionType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HOMEPAGE_LAYOUT_PRESETS, MAX_SECTIONS_PER_CONFIGURATION, MAX_SECTION_ITEMS } from '../homepage.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Optimistic concurrency: the draft version the client last read. Rejected with 409 when stale. */
export class VersionedDto {
  @Type(() => Number) @IsInt() @Min(1) expectedVersion!: number;
}

export class CreateHomepageSectionDto extends VersionedDto {
  @IsEnum(HomepageSectionType) type!: HomepageSectionType;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) title!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_SECTION_ITEMS) maxItems?: number;
  @IsOptional() @IsIn([...HOMEPAGE_LAYOUT_PRESETS]) layoutType?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() locationId?: string;
}

/** Section identity (type/key) and position are immutable here; position changes go through reorder. */
export class UpdateHomepageSectionDto extends VersionedDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) title?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_SECTION_ITEMS) maxItems?: number;
  @IsOptional() @IsIn([...HOMEPAGE_LAYOUT_PRESETS]) layoutType?: string;
  /** null clears the link. */
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() locationId?: string | null;
}

export class ReorderHomepageSectionsDto extends VersionedDto {
  @IsArray() @ArrayMaxSize(MAX_SECTIONS_PER_CONFIGURATION) @IsString({ each: true }) sectionIds!: string[];
}

export class SetHomepagePlacementsDto extends VersionedDto {
  /** Ordered list; the position in this array becomes the placement order. */
  @IsArray() @ArrayMaxSize(MAX_SECTION_ITEMS) @IsString({ each: true }) articleIds!: string[];
}

export class PublishHomepageDto extends VersionedDto {}
