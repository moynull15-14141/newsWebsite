import * as bcrypt from 'bcryptjs';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    article: { findFirst: jest.fn() },
    bookmark: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    notification: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    media: { findFirst: jest.fn() },
    readerProfile: { upsert: jest.fn() },
    session: { updateMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    savedJob: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    resume: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), count: jest.fn() },
    job: { findFirst: jest.fn() },
    jobApplication: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), update: jest.fn() },
  } as any;
  const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() } as any;
  let service: ReaderService;

  beforeEach(() => { jest.clearAllMocks(); service = new ReaderService(prisma, storage); });

  it('saves only published articles for reader accounts', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
    prisma.article.findFirst.mockResolvedValue({ id: 'article-1', status: 'PUBLISHED' });
    prisma.bookmark.upsert.mockResolvedValue({ id: 'bookmark-1' });
    await service.addBookmark('reader-1', 'article-1');
    expect(prisma.bookmark.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_articleId: { userId: 'reader-1', articleId: 'article-1' } } }));
  });

  it('isolates notification reads by user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markNotificationRead('reader-1', 'notice-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'notice-1', userId: 'reader-1', readAt: null } }));
  });

  describe('bookmarkStatus', () => {
    it('reports saved when a bookmark exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.bookmark.findUnique.mockResolvedValue({ id: 'bookmark-1' });
      await expect(service.bookmarkStatus('reader-1', 'article-1')).resolves.toEqual({ saved: true });
    });

    it('reports not saved when no bookmark exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.bookmark.findUnique.mockResolvedValue(null);
      await expect(service.bookmarkStatus('reader-1', 'article-1')).resolves.toEqual({ saved: false });
    });

    it('rejects non-reader accounts', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.bookmarkStatus('staff-1', 'article-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setAvatar', () => {
    it('sets the avatar from an image the reader themself uploaded', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.media.findFirst.mockResolvedValue({ id: 'media-1', publicUrl: 'https://cdn.example/a.png', altText: null, mimeType: 'image/png' });
      prisma.readerProfile.upsert.mockResolvedValue({ userId: 'reader-1', avatarMediaId: 'media-1' });
      const result = await service.setAvatar('reader-1', 'media-1');
      expect(prisma.media.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'media-1', uploadedById: 'reader-1' }) }));
      expect(result).toEqual({ id: 'media-1', publicUrl: 'https://cdn.example/a.png', altText: null });
    });

    it('rejects media not uploaded by this reader (no IDOR onto another user\'s media)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.media.findFirst.mockResolvedValue(null);
      await expect(service.setAvatar('reader-1', 'someone-elses-media')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.readerProfile.upsert).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    // Real bcrypt, not a mock: bcryptjs's exports aren't safely re-spyable across multiple `it`
    // blocks in this TS/Jest setup, and hashing a short fixed string is cheap enough not to matter.
    let user: { id: string; accountType: string; passwordHash: string };
    beforeAll(async () => {
      user = { id: 'reader-1', accountType: 'READER', passwordHash: await bcrypt.hash('OldPass1!', 4) };
    });

    it('changes the password and revokes existing sessions when the current password is correct', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({});
      prisma.session.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.changePassword('reader-1', 'OldPass1!', 'NewPass1!');

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'reader-1' }, data: { passwordHash: expect.any(String) } });
      expect(prisma.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'reader-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
      expect(result).toEqual({ message: 'Password changed. Please sign in again.' });
    });

    it('rejects an incorrect current password without touching sessions', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.changePassword('reader-1', 'WrongPass!', 'NewPass1!')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.session.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a new password identical to the current one', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.changePassword('reader-1', 'OldPass1!', 'OldPass1!')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('addSavedJob', () => {
    it('rejects saving a job that is not publicly eligible', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.job.findFirst.mockResolvedValue(null);
      await expect(service.addSavedJob('reader-1', 'job-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts (idempotent save, no duplicate)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', status: 'PUBLISHED' });
      prisma.savedJob.upsert.mockResolvedValue({ id: 'saved-1' });
      await service.addSavedJob('reader-1', 'job-1');
      expect(prisma.savedJob.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId_jobId: { userId: 'reader-1', jobId: 'job-1' } } }));
    });
  });

  describe('applyToJob', () => {
    it('rejects applying to a job that requires an external application method', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', applicationMethod: 'EXTERNAL_URL' });
      await expect(service.applyToJob('reader-1', 'job-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate application (unique constraint violation)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', applicationMethod: 'INTERNAL' });
      prisma.jobApplication.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.applyToJob('reader-1', 'job-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an application for an internal, eligible job', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.job.findFirst.mockResolvedValue({ id: 'job-1', applicationMethod: 'INTERNAL' });
      prisma.jobApplication.create.mockResolvedValue({ id: 'app-1', status: 'SUBMITTED' });
      const result = await service.applyToJob('reader-1', 'job-1', { coverLetter: 'Hello' });
      expect(result).toEqual({ id: 'app-1', status: 'SUBMITTED' });
    });
  });

  describe('withdrawApplication', () => {
    it('rejects withdrawing an already-decided application', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1', applicantId: 'reader-1', status: 'ACCEPTED' });
      await expect(service.withdrawApplication('reader-1', 'app-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects withdrawing another user\'s application (scoped by applicantId in the query)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.jobApplication.findFirst.mockResolvedValue(null);
      await expect(service.withdrawApplication('reader-1', 'someone-elses-app')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({ where: { id: 'someone-elses-app', applicantId: 'reader-1' } });
    });

    it('withdraws a submitted application', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.jobApplication.findFirst.mockResolvedValue({ id: 'app-1', applicantId: 'reader-1', status: 'SUBMITTED' });
      prisma.jobApplication.update.mockResolvedValue({ id: 'app-1', status: 'WITHDRAWN' });
      const result = await service.withdrawApplication('reader-1', 'app-1');
      expect((result as any).status).toBe('WITHDRAWN');
    });
  });

  describe('uploadResume', () => {
    const pdfBuffer = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(20)]);

    it('rejects a disallowed mime type', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      await expect(service.uploadResume('reader-1', { mimetype: 'image/png', size: 100, buffer: pdfBuffer } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects content that does not match its claimed mime type', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      const fakeBuffer = Buffer.from('not actually a pdf');
      await expect(service.uploadResume('reader-1', { mimetype: 'application/pdf', size: 100, buffer: fakeBuffer, originalname: 'resume.pdf' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uploads a valid PDF and marks it default when it is the first resume', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'reader-1', accountType: 'READER' });
      prisma.resume.count.mockResolvedValue(0);
      storage.upload.mockResolvedValue({ key: 'resumes/reader-1/x.pdf', url: 'https://cdn.example/x.pdf', size: 100, mimeType: 'application/pdf', filename: 'x.pdf' });
      prisma.resume.create.mockResolvedValue({ id: 'resume-1', isDefault: true });
      const result = await service.uploadResume('reader-1', { mimetype: 'application/pdf', size: 100, buffer: pdfBuffer, originalname: 'resume.pdf' } as any);
      expect((result as any).isDefault).toBe(true);
      expect(prisma.resume.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }));
    });
  });
});
