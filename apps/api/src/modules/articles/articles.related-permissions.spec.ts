import { REQUIRE_PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { ArticlesController } from './articles.controller';

describe('manual related-story permissions', () => {
  it('requires review authority for mutations', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, ArticlesController.prototype.updateManualRelated)).toEqual(['article.review']);
  });

  it('requires article read permission for management data', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSIONS_KEY, ArticlesController.prototype.getManualRelated)).toEqual(['article.read']);
  });
});
