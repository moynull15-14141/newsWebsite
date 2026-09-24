# Media Infrastructure (Phase 2R)

## Architecture

```
Application (Articles, Ads, Avatars, Site config)
        │
        ▼
   MediaService              — validation, key strategy, DB record, orphan detection
        │
        ▼
  StorageProvider (interface) — apps/api/src/common/storage/storage.provider.ts
   ├── LocalStorageProvider   — writes to disk, dev only
   └── S3StorageProvider      — Cloudflare R2 (S3-compatible), production
        │
        ▼
   Cloudflare R2 bucket `news-media` → public URL / future custom domain
```

Nothing outside `MediaService` and the `StorageProvider` implementations talks to a filesystem or to R2
directly. Articles, Ads (Phase 2Q), avatars, and site assets all go through `MediaService`, so storage
can change (e.g. adding a CDN, or a second provider) without touching those modules.

## Which provider is active

Set **one** of these (never both):

```
MEDIA_STORAGE_PROVIDER=local   # or r2
```

or the older name, still supported unchanged:

```
STORAGE_PROVIDER=local         # or s3
```

`MEDIA_STORAGE_PROVIDER` is checked first. Production refuses to boot on `local`/no remote provider (see
`apps/api/src/main.ts`'s `validateEnvironment()` and `StorageModule`).

## Object key strategy

Keys are always server-generated (a UUID), never the client's filename — see
`apps/api/src/modules/media/media-limits.ts`:

| Purpose | Key shape |
|---|---|
| `article` | `articles/{uuid}/original.{ext}` |
| `ad` | `ads/{uuid}/original.{ext}` |
| `avatar` | `avatars/{userId}/{uuid}/original.{ext}` |
| `site` | `site/{uuid}/original.{ext}` |
| `general` (direct-upload endpoint) | `media/{uuid}.{ext}` |

`{ext}` is derived from the **validated** MIME type, never from the client's filename — this is what
makes path traversal (`../../etc/passwd.png`) and double-extension tricks (`photo.jpg.exe`) structurally
impossible, not just filtered.

## Two upload paths, one service

Both end up in the same `MediaService` / `Media` table / validation:

1. **Direct server upload** (`POST /media`, multipart) — the file passes through the NestJS process.
   Used by the admin Media Library's "Upload" button and the existing avatar/ad-creative flows. Simple,
   fine for images up to the endpoint's 10MB Multer limit.
2. **Presigned upload** (`POST /media/upload/presign` → browser `PUT`s directly to storage →
   `POST /media/:id/complete`) — the file body never touches the NestJS process. This is the path meant
   for R2/S3 in production and for anything closer to the per-purpose size limits.
   - In **local dev**, `createPresignedUpload()` returns a URL pointing at this same API's own
     `PUT /media/local-upload` route instead of a real S3 URL — a genuine HTTP PUT that writes straight
     to disk, gated by an HMAC-signed, expiring token (see `LocalStorageProvider`). It is not a mock.
   - `completeUpload()` **never trusts the browser's "it worked"** — it calls `storage.exists()`, then
     reads the object back and re-runs the same magic-byte signature check and dimension detection the
     direct-upload path gets. A failed verification marks the row `FAILED` and (for a bad signature)
     deletes the object.

## Media status lifecycle

```
UPLOADING → READY           (completeUpload() verifies the object exists + is a real image)
UPLOADING → FAILED          (object missing, or bytes don't match the declared type)
READY     → (soft) DELETED  (foundation only — see "Orphan detection" below; nothing sets this yet)
```

Every row from before Phase 2R defaults to `READY` / `provider: LOCAL` — both true for every row that
already existed.

## Validation (every upload, either path)

- MIME allow-list: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.
- **Magic-byte signature check** (`hasValidImageSignature` in `media.service.ts`) — the client's claimed
  `Content-Type` is never trusted alone; a renamed script claiming `image/jpeg` is rejected because its
  first bytes aren't `FF D8 FF`.
- Size limits, per purpose, configurable via env (see `.env.example`): article/ad 10MB, avatar 5MB,
  general 20MB.
- Real dimension detection via `image-size` on the actual bytes — never the client-supplied width/height.

## Delete / replace safety

`remove()` refuses to delete media still referenced by an article's featured image, an ad creative, a
reader's avatar, an editorial collection cover, or an employer's logo/cover — it names what's using it
in the error rather than silently nulling the reference. `replace()` uploads a new file under a **new**
key and re-points every one of those references in a single transaction, leaving the old row alone (the
orphan-detection foundation, not `replace()`, is what would ever flag it for cleanup).

**Known limitation, not fixed by this phase**: an image embedded inside an article's TipTap body content
is a plain URL inside a JSON blob, not a tracked foreign key. Deleting that media 404s inside the
article body; `assertNotReferenced()` cannot see it.

## Orphan detection (foundation only — Step 24)

`GET /media/orphans` (permission: `media.manage`) reports, but never deletes:

- **Stalled uploads**: `UPLOADING` rows whose presign window expired without a `complete` call.
- **Unreferenced media**: `READY` rows not pointed to by any of the relations above, excluding anything
  uploaded in the last 24h (a just-uploaded image mid-draft hasn't been saved into a relation yet).

A future cleanup job consumes this; nothing in Phase 2R deletes automatically.

## API summary

| Method | Path | Permission | Notes |
|---|---|---|---|
| POST | `/media` | `media.upload` | Direct multipart upload |
| POST | `/media/upload/presign` | `media.upload` | Returns `{ mediaId, uploadUrl, objectKey, expiresIn, requiredHeaders }` |
| PUT | `/media/local-upload` | *(public — token-authorized)* | Local-dev only; real S3/R2 URLs bypass the API entirely |
| POST | `/media/:id/complete` | `media.upload` | Verifies the object, transitions UPLOADING→READY |
| POST | `/media/:id/replace` | `media.upload` | Uploads new file, re-points every reference |
| GET | `/media` | `media.upload` | Paginated; filters: `search`, `mimeType`, `status`, `uploadedById` |
| GET | `/media/:id` | `media.upload` | |
| GET | `/media/orphans` | `media.manage` | Detection/reporting only |
| PATCH | `/media/:id` | `media.manage` | Metadata only (alt/caption/credit) |
| DELETE | `/media/:id` | `media.manage` | Refuses if referenced |

## Consumers

- **Articles**: featured image (`Article.featuredImageId`), body images inserted via the editor's own
  media picker (ArticleEditorPage — a separate, pre-existing implementation; see "Known duplication"
  below).
- **Ads (Phase 2Q)**: creative desktop/mobile images, via `apps/admin/src/components/MediaPickerModal.tsx`
  and `CreativeFormModal.tsx`.
- **Avatars**: `reader.controller.ts`'s `/reader/avatar` endpoint calls `MediaService.upload()` directly;
  `ReaderService.setAvatar()` checks the media was uploaded by that same user before attaching it.
- **Employers**: logo/cover, same relation pattern as articles.

### Known duplication (not resolved this phase)

`ArticleEditorPage.tsx` has its own inline media browser (search/grid/upload), predating
`MediaPickerModal.tsx` (built for Phase 2Q's ad creatives). Both call the same `MediaService` underneath,
so there's no correctness issue, but it's two UI implementations of the same picker. Consolidating the
article editor onto `MediaPickerModal` was judged too risky to do inside this phase without dedicated
testing time on that specific, complex, already-working editor page — left as a known follow-up.

## Responsive image foundation

`public-article-select.ts` now selects `media.width`/`media.height`; `ArticlePage.tsx`'s hero image uses
them as real `width`/`height` attributes (+ a CSS `aspect-ratio` fallback), so the browser reserves the
right box before the image loads instead of the page jumping once it does. `ArticleCard.tsx` already used
fixed-aspect containers (`h-28 w-36`, `aspect-square`, etc.) for its own CLS-avoidance — `loading="lazy"`
was already present there. `srcset`/multiple derivatives/WebP-AVIF transcoding are architecturally
possible later (the `Media` row already has `width`/`height`; a derivative would just be a second `Media`
row or a new field) but are not built in this phase — not required yet, not worth the complexity now.

## Performance

- Every Media Library / picker listing is paginated server-side (`skip`/`take` in Prisma) — never loads
  the whole table.
- Article/ad/category public rendering selects only the specific Media fields it needs
  (`id, publicUrl, altText, width, height`), never the whole row, and never queries the Media table at
  all beyond that per-article/per-ad join.
- Presigned upload never proxies the file body through the NestJS process — the browser talks to storage
  directly (or, in local dev, to a single dedicated raw-body PUT route, not the JSON-parsing bulk of the
  API).
