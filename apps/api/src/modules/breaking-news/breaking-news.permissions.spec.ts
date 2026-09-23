import { REQUIRE_PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { BreakingNewsController } from './breaking-news.controller';

describe('BreakingNewsController permissions', () => {
  it('protects every admin route with breaking_news.manage at controller level', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, BreakingNewsController)).toEqual(['breaking_news.manage']);
  });
});
