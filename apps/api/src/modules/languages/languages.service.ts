import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';

/**
 * Languages are a small, rarely-changed table (a handful of rows), read on nearly every public
 * request to resolve `?lang=`. No caching layer is introduced for this phase — the table is tiny and
 * already indexed on `code` — but every read goes through this service so a cache can be added later
 * in one place.
 */
@Injectable()
export class LanguagesService {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.language.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  findAll() {
    return this.prisma.language.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  }

  async findById(id: string) {
    const language = await this.prisma.language.findUnique({ where: { id } });
    if (!language) throw new NotFoundException('Language not found');
    return language;
  }

  /** The platform default language. Every deployment must have exactly one; seeding guarantees it. */
  async getDefault() {
    const language = await this.prisma.language.findFirst({ where: { isDefault: true } });
    if (!language) throw new NotFoundException('No default language is configured');
    return language;
  }

  /**
   * Resolves a `?lang=` query value to an active Language, falling back to the default when the code
   * is missing, unknown, or belongs to a disabled language. Used by every public endpoint so "language
   * not found" never becomes a 404 for a reader — it just degrades to the default.
   */
  async resolveRequested(code?: string) {
    if (code) {
      const language = await this.prisma.language.findFirst({ where: { code, isActive: true } });
      if (language) return language;
    }
    return this.getDefault();
  }

  async findByCode(code: string) {
    const language = await this.prisma.language.findUnique({ where: { code } });
    if (!language) throw new NotFoundException(`Language "${code}" not found`);
    return language;
  }

  async create(dto: CreateLanguageDto) {
    if (dto.isDefault === false) {
      throw new BadRequestException('isDefault cannot be explicitly set to false on create; set another language as default instead.');
    }
    if (dto.isDefault && dto.isActive === false) {
      throw new BadRequestException('The default language must be active.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.isDefault) await tx.language.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        return tx.language.create({
          data: {
            code: dto.code,
            name: dto.name.trim(),
            nativeName: dto.nativeName.trim(),
            direction: dto.direction ?? 'ltr',
            isActive: dto.isActive ?? true,
            isDefault: dto.isDefault ?? false,
            sortOrder: dto.sortOrder ?? 0,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Language code "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateLanguageDto) {
    const language = await this.findById(id);

    if (dto.isActive === false && language.isDefault) {
      throw new BadRequestException('Cannot disable the default language. Set a different language as default first.');
    }
    if (dto.isDefault && dto.isActive === false) {
      throw new BadRequestException('The default language must be active.');
    }
    if (dto.isActive === false) {
      const activeCount = await this.prisma.language.count({ where: { isActive: true } });
      if (activeCount <= 1) throw new BadRequestException('At least one language must stay active.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.language.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.language.update({
        where: { id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          nativeName: dto.nativeName !== undefined ? dto.nativeName.trim() : undefined,
          direction: dto.direction,
          isActive: dto.isActive,
          isDefault: dto.isDefault,
          sortOrder: dto.sortOrder,
        },
      });
    });
  }
}
