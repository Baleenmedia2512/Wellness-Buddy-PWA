# Coach public site — live routing (MilesWeb)

Coach pages and the sitemap run on the **Node** app (`wellness-api` / `test-wellness-api`), not the CRA SPA folder.

## Paths that must hit Node

| Path | App |
|---|---|
| `/api/*` | Node (already) |
| `/coach/*` | Same Node app |
| `/_next/*` | Same Node app (CSS/JS for coach pages) |
| `/coach/sitemap.xml` | Same as `/coach/*` (preferred on MilesWeb) |
| `/coach-sitemap.xml` | SPA `.htaccess` rewrites → `/coach/sitemap.xml` |
| `/share/*` | Same Node app (existing shares) |

SPA (folder `wellnessvalley` / test site root) serves everything else.

## 1) Website `.htaccess` (SPA folder)

Ship from [`frontend/public/.htaccess`](../frontend/public/.htaccess). After `npm run build`, copy into the site root zip.

Must include (do **not** drop `coach-sitemap.xml`):

```apache
RewriteRule ^(api|coach|_next|share|coach-sitemap\.xml)(/|$) - [L]
```

Remove any rule that 302s `/coach` to Vercel.

## 2) cPanel / Node connect (hosting)

Web Applications list may show **only** `wellnessvalley.in/api` (and test `…/api`). That is normal.

SPA root `.htaccess` only **stops** rewriting `/coach` to `index.html`. It does **not** by itself send `/coach` into Node.

If live returns LiteSpeed “Proudly powered…” 404 while test returns `X-Powered-By: Next.js` with the same single `/api` app:

1. Open the **website** folder (not `wellness-api`): `/home/yvyunomg/wellnessvalley`.
2. Add Passenger mounts (same idea as test when `/coach` already hits Node without a second App URI):

| Path on website | File in repo |
|---|---|
| `wellnessvalley/coach/.htaccess` | [`frontend/public/coach/.htaccess`](../frontend/public/coach/.htaccess) |
| `wellnessvalley/_next/.htaccess` | [`frontend/public/_next/.htaccess`](../frontend/public/_next/.htaccess) |

Use the **CloudLinux** block (same shape as test’s `…/_next/.htaccess`), with live paths:

```apache
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/yvyunomg/wellness-api"
PassengerBaseURI "/coach"
PassengerNodejs "/home/yvyunomg/nodevenv/wellness-api/20/bin/node"
PassengerAppType node
PassengerStartupFile server.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
```

`/_next` is the same with `PassengerBaseURI "/_next"`.  
`PassengerNodejs` must match the live app virtualenv (`nodevenv/wellness-api/20/...`), not `test-wellness-api`.

3. Keep the SPA skip rule in [`frontend/public/.htaccess`](../frontend/public/.htaccess).
4. Restart the live Node app (`wellnessvalley.in/api`).

Optional check: open the **test** website document-root `.htaccess` / folders — if `coach` / `_next` (or CloudLinux Passenger blocks) already exist there, copy that pattern to live.

Do **not** set Application URL to domain `/` (breaks the CRA site). Prefer these website-folder mounts over extra Create Application rows unless MilesWeb support tells you otherwise.

## 3) Backend deploy

Deploy current backend (including `pages/coach/[...slug].js` and `pages/coach-sitemap.xml.js`) into `/home/yvyunomg/wellness-api` (or test path). Restart the Node app.

## 4) Verify

| Check | Pass |
|---|---|
| `https://wellnessvalley.in/coach/<city>/<area>/<name>` | HTML + response header `X-Powered-By: Next.js` |
| `https://wellnessvalley.in/coach/sitemap.xml` | `Content-Type: application/xml` + `<urlset>` |
| `https://wellnessvalley.in/coach-sitemap.xml` | Same XML (via `.htaccess` rewrite) |
| `https://wellnessvalley.in/robots.txt` | `Allow: /` + `Sitemap: …/coach-sitemap.xml` (not `Disallow: /`) |

Fail signs:

- LiteSpeed “Proudly powered…” 404 HTML → path not on Node  
- SPA login / CRA shell → SPA rewrite ate `/coach`  
- Redirect to `vercel.app` → old Vercel rewrite still present  

## Related

- Phase 2 Search Console / GBP: [`coach-seo-gsc-gbp-checklist.md`](./coach-seo-gsc-gbp-checklist.md)
