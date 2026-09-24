import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MediaPage from './MediaPage';
import { useAuthStore } from '../stores/auth-store';

type QueryResult = { data: unknown; isLoading: boolean; error: unknown };
type MutationResult = { mutate: () => void; isPending: boolean; isError: boolean; error: unknown };
let mockMediaQuery: () => QueryResult;
let mockUploadMutation: () => MutationResult;
let mockReplaceMutation: () => MutationResult;
let mockUpdateMutation: () => MutationResult;
let mockDeleteMutation: () => MutationResult;

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockMediaQuery(),
  useMutation: ({ mutationFn }: { mutationFn: (...args: unknown[]) => unknown }) => {
    // Distinguish by which mutationFn shape was passed is fragile; instead each test wires the specific
    // mock it needs and the three calls (upload/update/delete) come back in declaration order.
    void mutationFn;
    return nextMutation();
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

let mutationQueue: MutationResult[] = [];
function nextMutation(): MutationResult {
  return mutationQueue.shift() ?? { mutate: vi.fn(), isPending: false, isError: false, error: null };
}

function renderMediaPage() {
  // Order must match MediaPage's own useMutation declaration order: upload, replace, update, delete.
  mutationQueue = [mockUploadMutation(), mockReplaceMutation(), mockUpdateMutation(), mockDeleteMutation()];
  return renderToStaticMarkup(<MediaPage />);
}

const mediaItem = {
  id: 'm1',
  filename: 'sunset.jpg',
  originalFilename: 'sunset.jpg',
  mimeType: 'image/jpeg',
  size: 204800,
  storageKey: 'media/sunset.jpg',
  publicUrl: 'http://localhost/media/sunset.jpg',
  altText: 'A sunset',
  caption: null,
  credit: null,
  width: 800,
  height: 600,
  status: 'READY' as const,
  uploadedBy: { id: 'u1', name: 'Admin' },
  createdAt: '2026-09-20T00:00:00.000Z',
};

const noopMutation: () => MutationResult = () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null });

beforeEach(() => {
  mockUploadMutation = noopMutation;
  mockReplaceMutation = noopMutation;
  mockUpdateMutation = noopMutation;
  mockDeleteMutation = noopMutation;
});

describe('MediaPage — loading and empty states', () => {
  it('shows a loading indicator while media is loading', () => {
    mockMediaQuery = () => ({ data: undefined, isLoading: true, error: null });
    const markup = renderMediaPage();
    expect(markup).toContain('Loading...');
  });

  it('shows an empty state, never fake media, when the library is empty', () => {
    mockMediaQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });
    const markup = renderMediaPage();
    expect(markup).toContain('No media files found');
  });
});

describe('MediaPage — grid rendering', () => {
  it('renders a real media item with its metadata', () => {
    mockMediaQuery = () => ({ data: { data: [mediaItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderMediaPage();
    expect(markup).toContain('sunset.jpg');
    expect(markup).toContain('800×600');
    expect(markup).toContain('200 KB');
    expect(markup).toContain('alt="A sunset"');
  });
});

describe('MediaPage — upload status', () => {
  it('renders a non-READY item as a status placeholder, never as a broken/guessed image', () => {
    mockMediaQuery = () => ({ data: { data: [{ ...mediaItem, status: 'UPLOADING' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderMediaPage();
    expect(markup).not.toContain('<img');
    expect(markup).toContain('UPLOADING');
  });
});

describe('MediaPage — permission-aware controls', () => {
  it('hides Upload/Edit/Delete controls without media permissions', () => {
    useAuthStore.getState().clearAuth();
    mockMediaQuery = () => ({ data: { data: [mediaItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderMediaPage();
    expect(markup).not.toContain('>Upload<');
    expect(markup).not.toContain(`aria-label="Edit ${mediaItem.originalFilename}"`);
    expect(markup).not.toContain(`aria-label="Delete ${mediaItem.originalFilename}"`);
  });

  it('shows Upload/Edit/Delete controls for a user with media.upload and media.manage', () => {
    useAuthStore.getState().setAuth(
      { id: 'u1', name: 'Admin', email: 'admin@test.local', status: 'ACTIVE', roles: [{ id: 'r1', name: 'Admin', permissions: ['media.upload', 'media.manage'] }] },
      'token',
      'refresh',
    );
    mockMediaQuery = () => ({ data: { data: [mediaItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    const markup = renderMediaPage();
    expect(markup).toContain('>Upload<');
    expect(markup).toContain(`aria-label="Edit ${mediaItem.originalFilename}"`);
    expect(markup).toContain(`aria-label="Delete ${mediaItem.originalFilename}"`);
    useAuthStore.getState().clearAuth();
  });
});

describe('MediaPage — error states', () => {
  it('surfaces an upload failure with a useful message', () => {
    mockMediaQuery = () => ({ data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }, isLoading: false, error: null });
    mockUploadMutation = () => ({ mutate: vi.fn(), isPending: false, isError: true, error: new Error('API error: 400') });
    const markup = renderMediaPage();
    expect(markup).toContain('Upload failed');
  });

  it('surfaces a delete failure (e.g. media still referenced by an article) instead of failing silently', () => {
    mockMediaQuery = () => ({ data: { data: [mediaItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    mockDeleteMutation = () => ({ mutate: vi.fn(), isPending: false, isError: true, error: new Error('Cannot delete: this media is still used as the featured image/cover for 1 article.') });
    const markup = renderMediaPage();
    expect(markup).toContain('still used as the featured image');
  });

  it('surfaces a replace failure instead of failing silently', () => {
    mockMediaQuery = () => ({ data: { data: [mediaItem], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }, isLoading: false, error: null });
    mockReplaceMutation = () => ({ mutate: vi.fn(), isPending: false, isError: true, error: new Error('API error: 400') });
    const markup = renderMediaPage();
    expect(markup).toContain('Replace failed');
  });
});
