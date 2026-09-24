import { BadRequestException } from '@nestjs/common';
import { MediaLocalUploadController } from './media-local-upload.controller';

function buildController(storage: any) {
  return new MediaLocalUploadController(storage);
}

describe('MediaLocalUploadController', () => {
  it('rejects a request with no token', async () => {
    const controller = buildController({ verifyPresignToken: jest.fn(), writeRaw: jest.fn() });
    await expect(controller.put('', { headers: {}, body: Buffer.from('x') } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a token whose signature/expiry check fails, without writing anything', async () => {
    const writeRaw = jest.fn();
    const storage = { verifyPresignToken: jest.fn().mockImplementation(() => { throw new BadRequestException('Invalid upload token signature'); }), writeRaw };
    const controller = buildController(storage);

    await expect(controller.put('bad-token', { headers: {}, body: Buffer.from('x') } as any)).rejects.toThrow(/signature/);
    expect(writeRaw).not.toHaveBeenCalled();
  });

  it('rejects a PUT whose Content-Type does not match what the token authorized', async () => {
    const writeRaw = jest.fn();
    const storage = { verifyPresignToken: jest.fn().mockReturnValue({ key: 'media/a.png', contentType: 'image/png' }), writeRaw };
    const controller = buildController(storage);

    await expect(controller.put('good-token', { headers: { 'content-type': 'image/jpeg' }, body: Buffer.from('x') } as any)).rejects.toThrow(/Content-Type/);
    expect(writeRaw).not.toHaveBeenCalled();
  });

  it('rejects an empty body', async () => {
    const storage = { verifyPresignToken: jest.fn().mockReturnValue({ key: 'media/a.png', contentType: 'image/png' }), writeRaw: jest.fn() };
    const controller = buildController(storage);

    await expect(controller.put('good-token', { headers: { 'content-type': 'image/png' }, body: Buffer.alloc(0) } as any)).rejects.toThrow(/Empty upload body/);
  });

  it('writes the body to the token-committed key on a valid, matching request', async () => {
    const writeRaw = jest.fn();
    const storage = { verifyPresignToken: jest.fn().mockReturnValue({ key: 'media/a.png', contentType: 'image/png' }), writeRaw };
    const controller = buildController(storage);

    const result = await controller.put('good-token', { headers: { 'content-type': 'image/png' }, body: Buffer.from('bytes') } as any);

    expect(writeRaw).toHaveBeenCalledWith('media/a.png', Buffer.from('bytes'));
    expect(result).toEqual({ key: 'media/a.png', size: 5 });
  });
});
