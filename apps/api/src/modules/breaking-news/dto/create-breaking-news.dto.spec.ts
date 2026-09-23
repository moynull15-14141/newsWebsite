import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBreakingNewsDto } from './create-breaking-news.dto';

/**
 * The API's global ValidationPipe runs exactly this validate() call against every incoming request
 * body — testing it directly here is the fast, isolated way to prove "never allow arbitrary unsafe CSS
 * values to be injected" actually holds, without spinning up the whole HTTP stack.
 */
describe('CreateBreakingNewsDto color validation', () => {
  const base = { headline: 'Dhaka Metro announces new schedule' };

  it('accepts real hex colors, 3- and 6-digit', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, backgroundColor: '#D32F2F', textColor: '#FFF' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a CSS injection attempt disguised as a color', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, backgroundColor: 'red; } body { display: none' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'backgroundColor')).toBe(true);
  });

  it('rejects a url()/javascript: style value', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, backgroundColor: 'url(javascript:alert(1))' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'backgroundColor')).toBe(true);
  });

  it('rejects a named color (not a hex value)', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, backgroundColor: 'red' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'backgroundColor')).toBe(true);
  });

  it('rejects an invalid-length hex string', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, textColor: '#12345' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'textColor')).toBe(true);
  });

  it('rejects a gradient direction outside the allowed set', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, gradientDirection: 'INWARD_SPIRAL' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'gradientDirection')).toBe(true);
  });

  it('rejects a backgroundMode outside SOLID/GRADIENT', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { ...base, backgroundMode: 'RAINBOW' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'backgroundMode')).toBe(true);
  });

  it('requires a non-empty headline', async () => {
    const dto = plainToInstance(CreateBreakingNewsDto, { headline: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'headline')).toBe(true);
  });
});
