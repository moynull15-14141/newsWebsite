export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EDITOR_IN_CHIEF = 'EDITOR_IN_CHIEF',
  EDITOR = 'EDITOR',
  REPORTER = 'REPORTER',
  PHOTOGRAPHER = 'PHOTOGRAPHER',
  CONTRIBUTOR = 'CONTRIBUTOR',
  MODERATOR = 'MODERATOR',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum LocationType {
  COUNTRY = 'COUNTRY',
  DIVISION = 'DIVISION',
  DISTRICT = 'DISTRICT',
  UPAZILA = 'UPAZILA',
}

export enum CategoryStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TagStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  roles?: UserRoleInfo[];
}

export interface UserRoleInfo {
  id: string;
  name: string;
  permissions: string[];
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  status: TagStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: any;
  status: ArticleStatus;
  authorId: string;
  categoryId: string | null;
  featuredImageId: string | null;
  locationId: string | null;
  publishedAt: Date | null;
  reviewedAt: Date | null;
  reviewedById: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; name: string; email: string };
  category?: Category;
  location?: Location;
  reviewedBy?: { id: string; name: string; email: string };
  articleTags?: { tag: Tag }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
