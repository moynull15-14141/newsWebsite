import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageProvider } from './local.storage';

/** Exercises the real filesystem inside an isolated temp directory, cleaned up after every test. */
describe('LocalStorageProvider', () => {
  let uploadPath: string;
  let provider: LocalStorageProvider;

  const config = (base: string) => ({
    get: (key: string, fallback = '') => ({
      LOCAL_STORAGE_PATH: base,
      S3_PUBLIC_BASE_URL: 'http://localhost:3001/api/v1/media/files',
    }[key] ?? fallback),
  }) as any;

  const file = (name: string, contents = 'fake-image-bytes'): Express.Multer.File =>
    ({ buffer: Buffer.from(contents), mimetype: 'image/png', size: contents.length, originalname: name } as Express.Multer.File);

  beforeEach(() => {
    uploadPath = fs.mkdtempSync(path.join(os.tmpdir(), 'media-storage-test-'));
    provider = new LocalStorageProvider(config(uploadPath));
  });

  afterEach(() => {
    fs.rmSync(uploadPath, { recursive: true, force: true });
  });

  it('creates the upload directory on construction if it does not already exist', () => {
    const freshPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'media-storage-test-')), 'nested', 'uploads');
    expect(fs.existsSync(freshPath)).toBe(false);

    new LocalStorageProvider(config(freshPath));

    expect(fs.existsSync(freshPath)).toBe(true);
    fs.rmSync(path.dirname(freshPath), { recursive: true, force: true });
  });

  it('writes the uploaded file to the predictable, server-generated key path', async () => {
    const result = await provider.upload(file('photo.png'), 'media/2026-09-22-abcdef.png');

    const written = path.join(uploadPath, 'media', '2026-09-22-abcdef.png');
    expect(fs.existsSync(written)).toBe(true);
    expect(fs.readFileSync(written, 'utf8')).toBe('fake-image-bytes');
    expect(result.key).toBe('media/2026-09-22-abcdef.png');
    expect(result.size).toBe(file('photo.png').size);
    expect(result.mimeType).toBe('image/png');
  });

  it('creates nested subdirectories under the upload path as needed', async () => {
    await provider.upload(file('deep.png'), 'media/2026/09/deep-key.png');
    expect(fs.existsSync(path.join(uploadPath, 'media', '2026', '09', 'deep-key.png'))).toBe(true);
  });

  it('returns a public URL built from the configured base + the storage key', () => {
    expect(provider.getPublicUrl('media/foo.png')).toBe('http://localhost:3001/api/v1/media/files/media/foo.png');
  });

  it('the upload result URL matches getPublicUrl for the same key', async () => {
    const result = await provider.upload(file('a.png'), 'media/a.png');
    expect(result.url).toBe(provider.getPublicUrl('media/a.png'));
  });

  it('deletes an existing file from disk', async () => {
    await provider.upload(file('to-delete.png'), 'media/to-delete.png');
    const written = path.join(uploadPath, 'media', 'to-delete.png');
    expect(fs.existsSync(written)).toBe(true);

    await provider.delete('media/to-delete.png');

    expect(fs.existsSync(written)).toBe(false);
  });

  it('deleting an already-missing object does not throw (idempotent, no orphaned-record crash)', async () => {
    await expect(provider.delete('media/never-existed.png')).resolves.toBeUndefined();
  });

  it('rejects a key that attempts to escape the upload directory via path traversal', async () => {
    await expect(provider.upload(file('evil.png'), '../../../../etc/passwd')).rejects.toThrow('Invalid storage key');
  });

  it('rejects an absolute-path key that would bypass the configured upload directory', async () => {
    const outside = path.join(os.tmpdir(), 'outside-upload-dir.png');
    await expect(provider.upload(file('evil.png'), outside)).rejects.toThrow('Invalid storage key');
    expect(fs.existsSync(outside)).toBe(false);
  });
});
