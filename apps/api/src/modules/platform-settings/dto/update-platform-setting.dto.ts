import { IsDefined } from 'class-validator';

export class UpdatePlatformSettingDto {
  // Deliberately untyped/unvalidated by class-validator beyond "present" — every known setting today is
  // a boolean, but this store is a generic Json column (see PlatformSetting.value) and validating the
  // shape here would need a per-key schema. The controller's key allowlist (PLATFORM_SETTING_KEYS) is
  // what prevents this endpoint from becoming an arbitrary-key-value store.
  //
  // @IsDefined() is required so the global ValidationPipe's whitelist/forbidNonWhitelisted mode (see
  // main.ts) doesn't strip/reject this property for having no class-validator decorator at all — without
  // it, every PATCH here fails with "property value should not exist" regardless of body content.
  @IsDefined()
  value: any;
}
