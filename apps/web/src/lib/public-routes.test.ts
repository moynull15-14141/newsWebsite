import { describe, expect, it } from 'vitest';
import { publicArticleRoutes } from './public-routes';

describe('public article route contracts', () => {
  it('uses the backend tag article endpoint', () => {
    expect(publicArticleRoutes.tag('breaking-news')).toBe('/public/tags/breaking-news/articles');
  });

  it('uses the backend author article endpoint', () => {
    expect(publicArticleRoutes.author('author-1')).toBe('/public/authors/author-1/articles');
  });

  it('uses the backend location article endpoint and preserves hierarchy type separately', () => {
    expect(publicArticleRoutes.location('barisal')).toBe('/public/locations/barisal/articles');
  });

  it('encodes route identifiers', () => {
    expect(publicArticleRoutes.tag('cox/s-bazar')).toBe('/public/tags/cox%2Fs-bazar/articles');
  });
});
