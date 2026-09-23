import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeHost(request: Record<string, unknown> = {}) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), getHeader: jest.fn().mockReturnValue('req-123') };
  const req = { method: 'GET', originalUrl: '/api/v1/articles', headers: {}, ...request };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => req }) } as any;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  it('passes a deliberate HttpException\'s own safe message straight through', () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = makeHost();
    filter.catch(new BadRequestException('Title is required.'), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Title is required.' }));
  });

  it('never leaks a raw internal error\'s message or stack to the client', () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = makeHost();
    const dbError = new Error('connect ECONNREFUSED 10.0.0.5:5432 password="s3cr3t"');
    filter.catch(dbError, host);

    expect(response.status).toHaveBeenCalledWith(500);
    const [[body]] = response.json.mock.calls;
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(body)).not.toContain('s3cr3t');
    expect(body).toEqual({ statusCode: 500, message: 'Internal server error' });
  });

  it('never leaks a Prisma-style error message either', () => {
    const filter = new AllExceptionsFilter();
    const { host, response } = makeHost();
    const prismaLikeError = new Error('Invalid `prisma.user.findUnique()` invocation: Unique constraint failed on the fields: (`email`)');
    filter.catch(prismaLikeError, host);

    const [[body]] = response.json.mock.calls;
    expect(JSON.stringify(body)).not.toContain('prisma');
    expect(JSON.stringify(body)).not.toContain('constraint');
  });
});
