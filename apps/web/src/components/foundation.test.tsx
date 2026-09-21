import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Divider } from './Divider';
import { IconButton } from './IconButton';
import { ImagePlaceholder } from './ImagePlaceholder';
import { Skeleton } from './Skeleton';

describe('design foundation primitives', () => {
  it('lets utility classes control Skeleton height', () => {
    const markup = renderToStaticMarkup(<Skeleton className="h-80" />);

    expect(markup).toContain('h-80');
    expect(markup).not.toMatch(/style="[^"]*height/);
  });

  it('does not add implicit Skeleton width or height styles', () => {
    const markup = renderToStaticMarkup(<Skeleton className="h-4 w-3/4" />);

    expect(markup).toContain('h-4 w-3/4');
    expect(markup).not.toMatch(/style="[^"]*(width|height)/);
  });

  it('retains explicitly requested Skeleton dimensions', () => {
    const markup = renderToStaticMarkup(<Skeleton width={200} height={100} />);

    expect(markup).toContain('width:200px');
    expect(markup).toContain('height:100px');
  });

  it.each([
    ['16/9', 'aspect-video'],
    ['4/3', 'aspect-[4/3]'],
    ['1/1', 'aspect-square'],
  ] as const)('uses aspect-ratio sizing for %s placeholders', (aspect, expectedClass) => {
    const markup = renderToStaticMarkup(<ImagePlaceholder aspect={aspect} className="h-20 w-28" />);

    expect(markup).toContain(expectedClass);
    expect(markup).toContain('h-20 w-28');
    expect(markup).not.toContain('pb-[');
  });

  it('keeps buttons and icon buttons as native controls', () => {
    const button = renderToStaticMarkup(<Button disabled>Save</Button>);
    const iconButton = renderToStaticMarkup(<IconButton aria-label="Dismiss">x</IconButton>);

    expect(button).toMatch(/^<button/);
    expect(button).toContain('disabled=""');
    expect(iconButton).toMatch(/^<button/);
    expect(iconButton).toContain('aria-label="Dismiss"');
  });

  it('renders Divider as an empty semantic rule', () => {
    expect(renderToStaticMarkup(<Divider />)).toMatch(/^<hr/);
  });

  it('limits breaking animation to motion-safe environments', () => {
    expect(renderToStaticMarkup(<Badge variant="breaking">Breaking</Badge>)).toContain(
      'motion-safe:animate-pulse',
    );
  });
});
