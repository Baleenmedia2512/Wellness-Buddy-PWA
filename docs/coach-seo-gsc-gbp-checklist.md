# Coach SEO — Phase 2 ops (Search Console + Google Business)

Do this **after** live `/coach/...` returns Next.js HTML and `/coach-sitemap.xml` returns XML. See [`coach-seo-live-routing.md`](./coach-seo-live-routing.md).

## A) Google Search Console (once)

1. Open [Google Search Console](https://search.google.com/search-console).
2. Property: `https://wellnessvalley.in` (URL-prefix or Domain).
3. Complete ownership verification if needed.
4. Left menu → **Sitemaps** → submit:

```text
https://wellnessvalley.in/coach-sitemap.xml
```

5. Wait until status is **Success** (not “Couldn’t fetch”).
6. For launch coaches: **URL inspection** → paste each live `/coach/...` URL → **Request indexing**.

New publishes appear on the same sitemap URL automatically — no re-submit required for each coach.

## B) Google Business Profile (per real center)

For each physical nutrition / wellness center that should rank locally:

1. Confirm **Name / Address / Phone** match the public coach page (NAP consistency).
2. Set **Website** to that coach’s live URL, e.g. `https://wellnessvalley.in/coach/chennai/.../...`.
3. Keep categories accurate (e.g. nutritionist / wellness center — as appropriate).
4. Prefer real photos already used on the Digital Portfolio.

Do not invent a GBP for freestyle coaches with no physical center.

## C) Content quality (coaches / ops)

- City / Area correct on the form (fix Nominatim “Zone → wrong locality” manually when needed).
- Real About, phone / WhatsApp, and photos before expecting local rank.
- No keyword stuffing or fake “near me” copy.

## Success checks

- [ ] GSC sitemap = Success  
- [ ] Sample coach URLs = Indexed (or queued)  
- [ ] Key centers: GBP website = matching `/coach/...` link  
- [ ] NAP matches the public page  
