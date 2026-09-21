import { ReaderService } from './reader.service';

describe('ReaderService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    article: { findFirst: jest.fn() },
    bookmark: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    notification: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
  } as any;
  let service: ReaderService;

  beforeEach(() => { jest.clearAllMocks(); service = new ReaderService(prisma); });

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
});
