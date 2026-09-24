import { S3StorageProvider } from './s3.storage';
import { S3Client, NotFound } from '@aws-sdk/client-s3';

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args) }));

function fakeConfig(values: Record<string, string>) {
  return { get: (key: string, fallback = '') => values[key] ?? fallback } as any;
}

const LEGACY_CONFIG = {
  S3_ENDPOINT: 'https://s3.example.test',
  S3_REGION: 'auto',
  S3_BUCKET: 'news',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_BASE_URL: 'https://cdn.example.test/media',
};

describe('S3StorageProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects incomplete configuration', () => {
    expect(() => new S3StorageProvider(fakeConfig({}))).toThrow(/R2\/S3 storage requires/);
  });

  it('accepts the legacy S3_* env var names unchanged', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));
    const file = { buffer: Buffer.from('image'), mimetype: 'image/png', size: 5, originalname: 'a.png' } as Express.Multer.File;

    const result = await provider.upload(file, 'media/a.png');
    await provider.delete('media/a.png');

    expect(result.url).toBe('https://cdn.example.test/media/media/a.png');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('accepts the R2_* env var names, preferring them over legacy S3_* when both are set', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const provider = new S3StorageProvider(fakeConfig({
      ...LEGACY_CONFIG,
      R2_ENDPOINT: 'https://r2.example.test',
      R2_BUCKET_NAME: 'news-media',
      R2_ACCESS_KEY_ID: 'r2-key',
      R2_SECRET_ACCESS_KEY: 'r2-secret',
      R2_PUBLIC_URL: 'https://media.example.test',
    }));
    const file = { buffer: Buffer.from('image'), mimetype: 'image/png', size: 5, originalname: 'a.png' } as Express.Multer.File;

    const result = await provider.upload(file, 'media/a.png');
    expect(result.url).toBe('https://media.example.test/media/a.png');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('derives the R2 endpoint from R2_ACCOUNT_ID when R2_ENDPOINT is not set', () => {
    expect(() => new S3StorageProvider(fakeConfig({
      R2_ACCOUNT_ID: 'abc123',
      R2_BUCKET_NAME: 'news-media',
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_PUBLIC_URL: 'https://media.example.test',
    }))).not.toThrow();
  });

  it('exists() returns true when HeadObject succeeds', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));
    await expect(provider.exists('media/a.png')).resolves.toBe(true);
  });

  it('exists() returns false when the object is NotFound', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue((new NotFound({ message: 'not found', $metadata: {} })) as never);
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));
    await expect(provider.exists('media/missing.png')).resolves.toBe(false);
  });

  it('exists() rethrows a non-NotFound error rather than reporting it as missing', async () => {
    jest.spyOn(S3Client.prototype, 'send').mockRejectedValue(new Error('network blip') as never);
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));
    await expect(provider.exists('media/a.png')).rejects.toThrow('network blip');
  });

  it('readObject() returns the object bytes, or null when the object does not exist', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array(Buffer.from('hello')) } } as never)
      .mockRejectedValueOnce((new NotFound({ message: 'not found', $metadata: {} })) as never);
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));

    await expect(provider.readObject('media/a.png')).resolves.toEqual(Buffer.from('hello'));
    await expect(provider.readObject('media/missing.png')).resolves.toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('createPresignedUpload() returns an expiring URL with the content-type header the signature covers', async () => {
    mockGetSignedUrl.mockResolvedValue('https://s3.example.test/media/a.png?X-Amz-Signature=abc');
    const provider = new S3StorageProvider(fakeConfig(LEGACY_CONFIG));

    const result = await provider.createPresignedUpload('media/a.png', 'image/png', 600);

    expect(result.uploadUrl).toContain('X-Amz-Signature');
    expect(result.expiresIn).toBe(600);
    expect(result.requiredHeaders).toMatchObject({ 'Content-Type': 'image/png' });
  });
});
