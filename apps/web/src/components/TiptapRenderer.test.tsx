import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TiptapRenderer from './TiptapRenderer';

describe('TiptapRenderer — article body images', () => {
  it('renders an image node with the real media URL and alt text', () => {
    const content = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'http://localhost:3001/api/v1/media/files/media/photo.jpg', alt: 'A busy street in Dhaka' } }],
    };
    const markup = renderToStaticMarkup(<TiptapRenderer content={content} />);

    expect(markup).toContain('src="http://localhost:3001/api/v1/media/files/media/photo.jpg"');
    expect(markup).toContain('alt="A busy street in Dhaka"');
    expect(markup).toContain('A busy street in Dhaka'); // also shown as a caption
  });

  it('renders an image with no alt text without a caption or crashing', () => {
    const content = { type: 'doc', content: [{ type: 'image', attrs: { src: 'http://localhost:3001/media/x.jpg' } }] };
    const markup = renderToStaticMarkup(<TiptapRenderer content={content} />);

    expect(markup).toContain('<img');
    expect(markup).not.toContain('figcaption');
  });

  it('accepts content as a JSON string, matching how the API stores it', () => {
    const content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] });
    const markup = renderToStaticMarkup(<TiptapRenderer content={content} />);

    expect(markup).toContain('Hello world');
  });

  it('never crashes on malformed content — falls back to plain text instead', () => {
    const markup = renderToStaticMarkup(<TiptapRenderer content="not valid json {{{" />);
    expect(markup).toContain('not valid json');
  });

  it('renders nothing (not a crash) for empty/missing content', () => {
    expect(() => renderToStaticMarkup(<TiptapRenderer content={{}} />)).not.toThrow();
  });

  it('renders headings, paragraphs and bold/italic marks together with an image', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Some ', marks: [] }, { type: 'text', text: 'bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' text.' }] },
        { type: 'image', attrs: { src: 'http://localhost/media/inline.jpg', alt: 'Inline figure' } },
      ],
    };
    const markup = renderToStaticMarkup(<TiptapRenderer content={content} />);

    expect(markup).toContain('<h2');
    expect(markup).toContain('Section title');
    expect(markup).toContain('<strong>bold</strong>');
    expect(markup).toContain('src="http://localhost/media/inline.jpg"');
  });
});
