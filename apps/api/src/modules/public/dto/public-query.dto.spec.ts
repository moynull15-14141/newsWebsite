import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicArticleQueryDto } from './public-query.dto';

/**
 * DTO-level validation, exercised directly (no HTTP server needed) — this is what the global
 * ValidationPipe actually runs against every /public/* request, including GET /public/search.
 */
describe('PublicArticleQueryDto', () => {
  const validate1 = (plain: Record<string, unknown>) => validate(plainToInstance(PublicArticleQueryDto, plain));

  it('accepts a normal search term', async () => {
    const errors = await validate1({ search: 'bangladesh flood relief' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a Bangla search term unchanged', async () => {
    const errors = await validate1({ search: 'বাংলাদেশ' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a search term right at the 200-character limit', async () => {
    const errors = await validate1({ search: 'a'.repeat(200) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a search term over the 200-character limit', async () => {
    const errors = await validate1({ search: 'a'.repeat(201) });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects an unknown property the same way the global ValidationPipe does (whitelist + forbidNonWhitelisted) — e.g. the page\'s own "q" param, if sent straight through instead of translated to "search", must 400 rather than silently doing nothing', async () => {
    const instance = plainToInstance(PublicArticleQueryDto, { search: 'x', q: 'x' });
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });

  it('defaults page to 1 and limit to 20 when omitted', async () => {
    const instance = plainToInstance(PublicArticleQueryDto, {});
    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(20);
  });

  it('rejects a limit above 100', async () => {
    const errors = await validate1({ limit: 500 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
