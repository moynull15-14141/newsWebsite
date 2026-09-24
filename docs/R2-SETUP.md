# Cloudflare R2 Setup (Phase 2R)

This document is the exact manual steps needed to point production at the real `news-media` R2 bucket.
**No credentials are stored in this repo or this file.** As of this phase, `.env` has no R2 credentials
configured — this setup has not yet been performed against the real bucket.

Bucket in scope: **`news-media`** only. Never touch `bangla-ai-hub`, `fashion-ecommerce`, or `mediahub`.

## 1. Create R2 API credentials (Cloudflare dashboard)

1. Cloudflare dashboard → R2 → **Manage R2 API Tokens** → Create API Token.
2. Scope the token to **object read/write on the `news-media` bucket only** — not account-wide, not
   other buckets.
3. Note down (once, shown only at creation time):
   - Access Key ID
   - Secret Access Key
   - Your Cloudflare **Account ID** (visible on the R2 overview page, or in the dashboard URL).

## 2. Configure the API's environment

Set these on the API's production environment (never in a committed file):

```
MEDIA_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<your account id>
R2_ACCESS_KEY_ID=<the access key id from step 1>
R2_SECRET_ACCESS_KEY=<the secret access key from step 1>
R2_BUCKET_NAME=news-media
R2_PUBLIC_URL=<see step 3>
```

`R2_ENDPOINT` can be left unset — it's derived as `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
automatically (see `S3StorageProvider`). Set it explicitly only if Cloudflare ever requires a
jurisdiction-specific endpoint for this bucket.

## 3. Public URL — start with R2's own dev URL, then move to a custom domain

**Short term** (bucket → public, R2.dev URL):
1. R2 → `news-media` bucket → Settings → Public Access → enable "R2.dev subdomain".
2. Copy the `https://pub-xxxxxxxx.r2.dev` URL it gives you into `R2_PUBLIC_URL`.

This works immediately but ties production to `r2.dev`, which the codebase deliberately avoids depending
on permanently — `R2_PUBLIC_URL` is the one place that URL is ever referenced, so switching later is a
one-variable change, not a code change.

**Recommended before real production traffic** (custom domain):
1. R2 → `news-media` bucket → Settings → Custom Domains → Connect Domain.
2. Enter the subdomain you want, e.g. `media.bdnews.com` (or `cdn.bdnews.com`).
3. Cloudflare will ask you to add/confirm a DNS record (if the domain's DNS already lives on Cloudflare,
   this is usually automatic; otherwise add the CNAME it shows you).
4. Wait for the domain to show "Active" (HTTPS is provisioned automatically by Cloudflare).
5. Set `R2_PUBLIC_URL=https://media.bdnews.com` (no trailing slash).
6. Restart the API. Nothing else changes — every already-uploaded object's `publicUrl` in the `Media`
   table was already just `${R2_PUBLIC_URL}/${key}`, so existing rows start resolving through the new
   domain immediately without a migration, as long as the key layout under the bucket hasn't changed.

## 4. CORS (only needed for the presigned-upload flow)

The browser PUTs directly to R2 for a presigned upload, so R2 needs a CORS policy allowing that from the
app's own origins. In the R2 bucket → Settings → CORS Policy, add:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:5174"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "MaxAgeSeconds": 3600
  }
]
```

Add the real production web/admin origins (e.g. `https://bdnews.com`, `https://admin.bdnews.com`) to
`AllowedOrigins` once those domains are finalized — do not use `"*"` if avoidable, since a presigned PUT
URL is scoped to one object key already, but an open CORS policy still lets any site *attempt* uploads
against valid tokens if one ever leaked.

## 5. Cache behavior

Every object this app writes is uploaded with `Cache-Control: public, max-age=31536000, immutable`
(`IMMUTABLE_CACHE_CONTROL` in `s3.storage.ts`) — safe because every key is a UUID that's never reused or
overwritten in place (`replace()` always uploads under a brand-new key). No extra Cloudflare cache rule
is required for this to work; R2's own edge cache and any CDN in front of the custom domain will honor
that header as-is.

## 6. Verifying the setup

Once the above is configured, from the API environment:

```bash
# Sanity-check the bucket is reachable with these credentials (read-only, no writes)
node -e "
require('dotenv').config();
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const client = new S3Client({
  endpoint: process.env.R2_ENDPOINT || \`https://\${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
  region: 'auto',
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }))
  .then(() => console.log('OK: bucket reachable'))
  .catch((e) => console.error('FAILED:', e.name, e.message));
"
```

Then do a real end-to-end check through the app itself: presign → PUT → complete → confirm the returned
`publicUrl` loads in a browser → delete. This is exactly what Phase 2R's own QA does against local
storage (see `docs/MEDIA.md`); repeat it once `MEDIA_STORAGE_PROVIDER=r2` is set, using a clearly
temporary object (e.g. `articles/qa-.../original.jpg`) and cleaning it up afterward — never against
`bangla-ai-hub`, `fashion-ecommerce`, or `mediahub`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `R2/S3 storage requires R2_ENDPOINT (or R2_ACCOUNT_ID)...` at boot | One of the required R2_*/legacy S3_* vars is missing — see the error message for exactly which. |
| Presigned PUT from the browser fails with a CORS error in devtools | The bucket's CORS policy doesn't list the calling origin, or doesn't allow `PUT`. |
| `complete` returns "the file was not found in storage" | The browser's PUT to the presigned URL failed or was never made — check the network tab for the PUT's actual status, and that it happened before the URL's `expiresIn` (10 minutes) elapsed. |
| Images 404 through the custom domain but work via the R2.dev URL | The custom domain isn't "Active" yet, or DNS hasn't propagated — R2_PUBLIC_URL was switched too early. |
| Production boots with `local` storage by mistake | `validateEnvironment()` in `main.ts` should have refused to boot — if it didn't, check `MEDIA_STORAGE_PROVIDER`/`STORAGE_PROVIDER` are actually reaching the process (not shadowed by a stale `.env` on the deploy target). |
