import { PlatformSettingsService } from './platform-settings.service';
import { isKnownPlatformSettingKey } from './platform-settings.constants';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: any;
  let auditLog: any;

  beforeEach(() => {
    prisma = {
      platformSetting: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    auditLog = { record: jest.fn().mockResolvedValue({}) };
    service = new PlatformSettingsService(prisma, auditLog);
  });

  describe('isKnownPlatformSettingKey', () => {
    it('accepts a known key', () => {
      expect(isKnownPlatformSettingKey('employer_platform_enabled')).toBe(true);
    });

    it('rejects an unknown key', () => {
      expect(isKnownPlatformSettingKey('some_made_up_key')).toBe(false);
    });
  });

  describe('get', () => {
    it('returns null when no row exists (fail-closed default)', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(null);
      const value = await service.get('employer_platform_enabled');
      expect(value).toBeNull();
    });

    it('returns the stored value', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({ key: 'auto_publish', value: true });
      const value = await service.get('auto_publish');
      expect(value).toBe(true);
    });

    it('serves a second read from cache without hitting prisma again', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({ key: 'auto_publish', value: false });
      await service.get('auto_publish');
      await service.get('auto_publish');
      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('set', () => {
    it('upserts the row, invalidates the cache, and writes an audit log entry', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({ key: 'auto_publish', value: false });
      await service.get('auto_publish'); // warm the cache

      prisma.platformSetting.upsert.mockResolvedValue({ key: 'auto_publish', value: true });
      await service.set('auto_publish', true, 'admin-1');

      expect(prisma.platformSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { key: 'auto_publish' },
      }));
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({
        employerId: null, actorId: 'admin-1', action: 'platform_setting.updated',
      }));

      // Cache was invalidated — the next get() must hit prisma again, not return the stale cached false.
      prisma.platformSetting.findUnique.mockResolvedValue({ key: 'auto_publish', value: true });
      const value = await service.get('auto_publish');
      expect(value).toBe(true);
      expect(prisma.platformSetting.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAll', () => {
    it('returns every known key', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(null);
      const all = await service.getAll();
      expect(Object.keys(all)).toEqual(expect.arrayContaining(['employer_platform_enabled', 'auto_publish', 'paid_job_posting_enabled']));
    });
  });
});
