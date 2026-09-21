import { S3StorageProvider } from './s3.storage';
import { S3Client } from '@aws-sdk/client-s3';

describe('S3StorageProvider', () => {
  const config = {
    get: (key: string, fallback = '') => ({
      S3_ENDPOINT: 'https://s3.example.test',
      S3_REGION: 'auto',
      S3_BUCKET: 'news',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_PUBLIC_BASE_URL: 'https://cdn.example.test/media',
    }[key] ?? fallback),
  } as any;

  afterEach(() => jest.restoreAllMocks());

  it('rejects incomplete configuration', () => {
    expect(() => new S3StorageProvider({ get: () => '' } as any)).toThrow(/requires S3_REGION/);
  });

  it('uploads, deletes, and generates a public URL', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const provider = new S3StorageProvider(config);
    const file = { buffer: Buffer.from('image'), mimetype: 'image/png', size: 5, originalname: 'a.png' } as Express.Multer.File;

    const result = await provider.upload(file, 'media/a.png');
    await provider.delete('media/a.png');

    expect(result.url).toBe('https://cdn.example.test/media/media/a.png');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
