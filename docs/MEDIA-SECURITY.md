# Media Security (Phase 2R)

Audit of the media upload/serving pipeline against the threat categories it needs to resist, and what
each control actually is (file + mechanism), not just a claim.

## Authentication & authorization

- Every `/media/*` endpoint except `PUT /media/local-upload` sits behind `JwtAuthGuard` + `RolesGuard`
  (`media.controller.ts`). Permissions reused from the existing RBAC system — no parallel authorization
  model was introduced: `media.upload` gates create/read/presign/complete/replace; `media.manage` gates
  metadata edit, delete, and orphan reporting.
- `PUT /media/local-upload` is intentionally public — but "public" doesn't mean "unauthenticated write":
  the HMAC-signed, expiring token in the URL *is* the authorization, exactly like a real presigned S3 URL
  has no bearer-token check either. See "Local presign token" below.

## IDOR / BOLA

- `completeUpload(id, userId, permissions)` — only the uploader, or someone with `media.manage`, may
  transition their own `UPLOADING` row to `READY`. Without this check, User B could complete User A's
  pending upload and force it to whatever bytes B controls got written under A's intended key.
  (`media.service.spec.ts`: "rejects completing another user's upload without media.manage".)
- `replace(id, ...)` has the identical check — only the original uploader or `media.manage` may replace.
- `ReaderService.setAvatar()` (pre-existing, unchanged) already scoped avatar selection to
  `media.findFirst({ where: { id, uploadedById: userId, ... } })` — a reader cannot set another user's
  upload as their own avatar.
- `MediaEventsService`-equivalent check for media itself: `remove()`/`replace()` operate on the row found
  by `id`, and every FK-repoint in `replace()` is scoped to that exact media id — no query ever trusts a
  client-supplied "which article/campaign does this belong to" without checking the DB relation first.

## Path traversal / object-key manipulation

- Object keys are **always server-generated** (`randomUUID()` + a fixed purpose-prefix), never derived
  from the client's filename beyond a validated file extension. The client's `filename`/`originalname`
  is stored only as a display label (`originalFilename` column), never used to build a path.
- `LocalStorageProvider.resolveSafePath()` independently re-validates that any key resolves inside the
  configured upload directory, rejecting `../` escapes — defense-in-depth even though the key is already
  server-generated (`local.storage.spec.ts`: "rejects a key that attempts to escape the upload directory").

## MIME spoofing

- The client's `Content-Type` (multipart) or declared `contentType` (presign request) is **never trusted
  alone**. `hasValidImageSignature()` in `media.service.ts` checks the file's actual leading bytes against
  the claimed type (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF...WEBP`, GIF `GIF87a`/`GIF89a`).
  - Direct upload: checked before the file ever reaches storage.
  - Presigned upload: `completeUpload()` reads the object back from storage and runs the **identical**
    check — a presigned upload does not get a weaker validation pass just because the bytes bypassed the
    NestJS process on the way in. A mismatch marks the row `FAILED` and deletes the object.
- Allow-listed MIME types only: `image/jpeg`, `image/png`, `image/webp`, `image/gif`. No executable,
  HTML, or script upload is possible through either path — both the Multer `fileFilter` (direct upload)
  and `createPresignedUpload()`'s own check reject anything else before a key is even generated.
- **SVG is not in the allow-list** — deliberately, since an SVG can carry embedded `<script>`/event
  handlers and would need dedicated sanitization this phase doesn't implement. Adding SVG support later
  requires that sanitization step first, not just adding the MIME type to the list.

## Oversized uploads / DoS via size

- Direct upload: Multer's own `limits.fileSize` (10MB) plus `MediaService.upload()`'s own check.
- Presigned upload: `createPresignedUpload()` checks the **declared** size against the purpose's
  configured limit before issuing a URL (article/ad 10MB, avatar 5MB, general 20MB — configurable, see
  `media-limits.ts`). This is a soft gate (a presigned PUT's actual body size isn't independently
  enforced by this app once the URL is issued — R2/S3 itself would need a `content-length-range` POST
  policy condition for a hard server-side cap, which isn't implemented here); real production hardening
  before high-value abuse-resistance would add that condition to the presigned request.
- `PUT /media/local-upload` in dev is capped by the `express.raw({ limit: '25mb' })` body parser.

## Malicious/malformed filenames

- Never used to build a storage path (see "Path traversal" above). Stored only as display text
  (`originalFilename`), rendered as plain text in the admin Media Library, never interpolated into HTML
  or executed.

## XSS

- No user-supplied string from this pipeline (filename, alt text, caption, credit) is ever rendered as
  HTML — React's default text-node rendering (JSX `{expression}`) escapes it everywhere it's shown.
- SVG exclusion (above) removes the main realistic XSS vector for an "image" upload pipeline.

## SSRF / arbitrary URL fetching

- **Nothing in this pipeline fetches a client-supplied URL.** Every upload path receives bytes directly
  (multipart body, or a browser PUT to a URL *this server issued*) — there is no "upload by URL" feature,
  and Phase 2R deliberately does not add one (per the master task's explicit instruction not to add
  server-side arbitrary URL fetching without a specific SSRF-safe need).

## Credential exposure

- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (and the legacy `S3_*` equivalents) are read only by
  `S3StorageProvider`, server-side, via `ConfigService`. Verified after this phase's build:
  `grep`-ing the built `apps/web/dist` and `apps/admin/dist` bundles for `R2_SECRET`, `R2_ACCESS_KEY`,
  `S3_SECRET`, `S3_ACCESS_KEY`, `JWT_SECRET` returns **no matches** — nothing leaked into either frontend
  bundle.
- Neither frontend app ever imports `@aws-sdk/*` or references these env var names at all — Vite only
  exposes vars explicitly prefixed `VITE_`, and none of the R2/S3 vars use that prefix, so they are
  structurally excluded from the frontend bundle regardless.
- The Media API response shape never includes a storage secret — `bucket`/`provider`/`storageKey` are
  metadata, not credentials, and are safe to expose to an authenticated admin (they already need
  `media.upload` to see them).

## Local presign token (dev-only mechanism)

`LocalStorageProvider.sign()`/`verifyPresignToken()` — an HMAC-SHA256 token over `{ key, contentType, exp
}`, keyed by `JWT_SECRET` (reused, not a new secret to manage), checked with `crypto.timingSafeEqual` to
avoid a timing side-channel on the signature comparison. Verified: a tampered token is rejected
(signature check fails), an expired token is rejected (`Date.now() > exp`), and a mismatched
`Content-Type` between what the token authorized and what the PUT actually sends is rejected server-side
(`media-local-upload.controller.spec.ts`). This mechanism only exists for local development — in any
environment with `MEDIA_STORAGE_PROVIDER=r2`, `createPresignedUpload()` never touches this code path at
all; the browser gets a real, independently-expiring S3-signature URL instead.

## Public/private confusion

- Every `Media` row's `publicUrl` is intentionally public once `status: READY` — this pipeline has no
  private-media concept yet (all current consumers — articles, ads, avatars, employer logos — are
  public-facing content). If a private-media use case is added later, it needs its own explicit
  authorization check on read, which does not exist today; this is a scope boundary, not an oversight.

## What this phase does **not** claim to have solved

- Rate limiting specific to the media upload endpoints beyond whatever the app's existing global
  rate-limiter already covers — not audited as part of this phase.
- A hard server-side byte-size enforcement on presigned uploads (see "Oversized uploads" above) — the
  declared size is checked before issuing the URL, but R2 itself isn't configured with a matching
  `content-length-range` policy condition in this phase.
- SVG support (excluded, not sanitized-and-allowed).
- Antivirus/malware scanning of uploaded bytes — out of scope for this phase; the validation here is
  format/type/size correctness, not malware detection.
