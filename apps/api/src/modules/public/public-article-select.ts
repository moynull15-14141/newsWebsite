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
  updatedAt: true,
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
  // width/height power the responsive-image foundation (real intrinsic size on <img>, so the browser can
  // reserve the right box before the image loads instead of the layout jumping once it does).
  media: { select: { id: true, publicUrl: true, altText: true, width: true, height: true } },
  _count: { select: { comments: { where: { status: CommentStatus.APPROVED } } } },
};
