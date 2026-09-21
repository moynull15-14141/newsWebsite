import { BadRequestException } from '@nestjs/common';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const prisma = {
    article: { findUnique: jest.fn() },
    comment: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    commentReport: { create: jest.fn() },
  } as any;
  let service: CommentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommentsService(prisma);
  });

  it('creates guest comments as pending on published articles', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'article-1', status: 'PUBLISHED' });
    prisma.comment.create.mockResolvedValue({ id: 'comment-1', status: 'PENDING' });

    const result = await service.create('story', { content: 'A useful comment', guestName: 'Reader' }, undefined, 'Reader');

    expect(result.status).toBe('PENDING');
    expect(prisma.comment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', guestName: 'Reader' }) }));
  });

  it('rejects comments on unpublished articles', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'article-1', status: 'DRAFT' });
    await expect(service.create('story', { content: 'Nope', guestName: 'Reader' }, undefined, 'Reader')).rejects.toThrow('Article not found');
  });

  it('blocks duplicate submissions within the short abuse window', async () => {
    prisma.article.findUnique.mockResolvedValue({ id: 'article-1', status: 'PUBLISHED' });
    prisma.comment.create.mockResolvedValue({ id: 'comment-1', status: 'PENDING' });
    await service.create('story', { content: 'Same message', guestName: 'Reader' }, undefined, 'Reader');
    await expect(service.create('story', { content: 'Same message', guestName: 'Reader' }, undefined, 'Reader')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft deletes comments instead of removing moderation history', async () => {
    prisma.comment.findUnique.mockResolvedValue({ id: 'comment-1' });
    prisma.comment.update.mockResolvedValue({ id: 'comment-1', status: 'DELETED' });
    await service.remove('comment-1');
    expect(prisma.comment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DELETED' }) }));
  });
});
