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

If `/coach/<slug>` already returns Next.js HTML with only App URI `/api`, do **not** create extra Node apps for `/coach`. Put the sitemap under **`/coach/sitemap.xml`** and rewrite `/coach-sitemap.xml` in the SPA `.htaccess` (see `frontend/public/.htaccess`).

Only add a separate App URI if `/coach/...` itself never reaches Node.

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
