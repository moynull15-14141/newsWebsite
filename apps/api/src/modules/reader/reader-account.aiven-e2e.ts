import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ReaderModule } from './reader.module';
import { ReaderService } from './reader.service';

config({ path: '../../.env' });
jest.setTimeout(60_000);

describe('Phase 2N reader account (real Aiven E2E)', () => {
  let prisma: PrismaService; let service: ReaderService; let userId = ''; let staffId = ''; let articleId = ''; let mediaId = '';
  const marker = `phase2n-${randomUUID()}`;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || ''); if (!url.hostname.endsWith('.aivencloud.com')) throw new Error('Refusing E2E: not Aiven');
    const moduleRef = await Test.createTestingModule({ imports: [PrismaModule, ReaderModule] }).compile(); prisma = moduleRef.get(PrismaService); service = moduleRef.get(ReaderService);
    const passwordHash = await bcrypt.hash('OldPassword9!', 12);
    const [reader, staff] = await Promise.all([
      prisma.user.create({ data: { name: marker, email: `${marker}@example.invalid`, passwordHash, accountType: 'READER', verifiedAt: new Date(), readerProfile: { create: { displayName: marker } }, notificationPreference: { create: {} } } }),
      prisma.user.create({ data: { name: `${marker}-staff`, email: `${marker}-staff@example.invalid`, passwordHash, accountType: 'STAFF' } }),
    ]); userId = reader.id; staffId = staff.id;
    const [category, language] = await Promise.all([prisma.category.findFirstOrThrow(), prisma.language.findFirstOrThrow({ where: { isDefault: true } })]);
    const article = await prisma.article.create({ data: { title: marker, slug: marker, authorId: staffId, categoryId: category.id, languageId: language.id, status: 'PUBLISHED', publishedAt: new Date(), content: { type: 'doc' } } }); articleId = article.id;
    const media = await prisma.media.create({ data: { filename: `${marker}.png`, originalFilename: 'avatar.png', mimeType: 'image/png', size: 100, storageKey: `test/${marker}.png`, publicUrl: `https://example.invalid/${marker}.png`, uploadedById: userId } }); mediaId = media.id;
  });
  afterAll(async () => { if (prisma) { await prisma.bookmark.deleteMany({ where: { userId } }); await prisma.article.deleteMany({ where: { id: articleId } }); await prisma.readerProfile.updateMany({ where: { userId }, data: { avatarMediaId: null } }); await prisma.media.deleteMany({ where: { id: mediaId } }); await prisma.user.deleteMany({ where: { id: { in: [userId, staffId] } } }); expect(await prisma.user.count({ where: { id: { in: [userId, staffId] } } })).toBe(0); } });
  it('persists own profile, theme, privacy, notifications and avatar', async () => {
    await service.updateProfile(userId, { displayName: 'Reader Updated', phone: '+8801700000000', bio: 'Reader bio', location: 'Dhaka', theme: 'DARK', profilePublic: true });
    await service.updatePreferences(userId, { breakingNews: false, jobAlerts: true, accountSecurity: true });
    await service.setAvatar(userId, mediaId); const profile = await service.getProfile(userId);
    expect(profile?.readerProfile).toMatchObject({ displayName: 'Reader Updated', theme: 'DARK', profilePublic: true, avatarMediaId: mediaId });
    expect(profile?.notificationPreference).toMatchObject({ breakingNews: false, jobAlerts: true });
  });
  it('saves once, reports state, paginates and removes only its own bookmark', async () => {
    const first = await service.addBookmark(userId, articleId); const second = await service.addBookmark(userId, articleId); expect(second.id).toBe(first.id);
    expect(await service.bookmarkStatus(userId, articleId)).toEqual({ saved: true }); expect((await service.getBookmarks(userId, 1, 1)).meta.total).toBe(1);
    await service.removeBookmark(userId, articleId); expect(await service.bookmarkStatus(userId, articleId)).toEqual({ saved: false });
  });
  it('rejects staff accounts and changes password with current-password verification', async () => {
    await expect(service.getProfile(staffId)).rejects.toThrow('Reader account required');
    await expect(service.changePassword(userId, 'wrong', 'NewPassword9!')).rejects.toThrow('Current password is incorrect');
    await service.changePassword(userId, 'OldPassword9!', 'NewPassword9!');
    expect(await bcrypt.compare('NewPassword9!', (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash)).toBe(true);
  });
});
