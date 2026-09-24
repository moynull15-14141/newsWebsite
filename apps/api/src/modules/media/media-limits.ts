import { ConfigService } from '@nestjs/config';

/** Upload purpose drives both the object-key namespace (see MediaService.buildKey) and the size limit —
 * configurable per-purpose via env rather than one constant scattered across every caller (spec Step 6). */
export enum MediaUploadPurpose {
  ARTICLE = 'article',
  AD = 'ad',
  AVATAR = 'avatar',
  SITE = 'site',
  GENERAL = 'general',
}

const DEFAULT_MAX_SIZE_MB: Record<MediaUploadPurpose, number> = {
  [MediaUploadPurpose.ARTICLE]: 10,
  [MediaUploadPurpose.AD]: 10,
  [MediaUploadPurpose.AVATAR]: 5,
  [MediaUploadPurpose.SITE]: 10,
  [MediaUploadPurpose.GENERAL]: 20,
};

const ENV_KEY: Record<MediaUploadPurpose, string> = {
  [MediaUploadPurpose.ARTICLE]: 'MEDIA_MAX_SIZE_ARTICLE_MB',
  [MediaUploadPurpose.AD]: 'MEDIA_MAX_SIZE_AD_MB',
  [MediaUploadPurpose.AVATAR]: 'MEDIA_MAX_SIZE_AVATAR_MB',
  [MediaUploadPurpose.SITE]: 'MEDIA_MAX_SIZE_SITE_MB',
  [MediaUploadPurpose.GENERAL]: 'MEDIA_MAX_SIZE_GENERAL_MB',
};

export function getMaxUploadSizeBytes(configService: ConfigService, purpose: MediaUploadPurpose): number {
  const configuredMb = configService.get<string>(ENV_KEY[purpose]);
  const mb = configuredMb ? Number(configuredMb) : DEFAULT_MAX_SIZE_MB[purpose];
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_SIZE_MB[purpose]) * 1024 * 1024;
}

/** Object-key namespace per purpose (spec Step 5). Never derived from user input beyond the purpose
 * itself and a server-generated UUID — the original filename never reaches the storage key. */
export function buildObjectKeyPrefix(purpose: MediaUploadPurpose, ownerId?: string): string {
  switch (purpose) {
    case MediaUploadPurpose.ARTICLE: return 'articles';
    case MediaUploadPurpose.AD: return 'ads';
    case MediaUploadPurpose.AVATAR: return ownerId ? `avatars/${ownerId}` : 'avatars';
    case MediaUploadPurpose.SITE: return 'site';
    case MediaUploadPurpose.GENERAL:
    default: return 'media';
  }
}
