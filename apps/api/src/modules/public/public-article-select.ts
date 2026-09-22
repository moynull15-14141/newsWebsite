import { CommentStatus } from '@prisma/client';

/** Article shape returned by every public listing, including the homepage (active and preview). */
export const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  canonicalUrl: true,
  noIndex: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  viewCount: true,
  isBreaking: true,
  breakingPriority: true,
  translationGroupId: true,
  language: { select: { id: true, code: true, nativeName: true } },
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
  location: { select: { id: true, name: true, slug: true, type: true } },
  articleTags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  media: { select: { id: true, publicUrl: true } },
  _count: { select: { comments: { where: { status: CommentStatus.APPROVED } } } },
};
