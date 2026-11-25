# Transformation collage — ChatGPT prompt (no app change)

Use this outside the Wellness Valley app.  
App Transformation module stays **Before | After** upload + existing share card.  
This flow creates **one collage image** (Before | After | Now) for WhatsApp / social share.

---

## Steps

1. Open ChatGPT (image-capable model).
2. Paste the **WhatsApp short prompt** (or the **Full prompt** for stricter face lock).
3. Attach **3 photos in this exact order**:
   1. BEFORE  
   2. AFTER  
   3. NOW  
4. Send.
5. Download the **single collage** image.
6. If the face looks different in any panel → reject and regenerate with the Full prompt.

---

## WhatsApp short prompt (copy-paste)

```
I will upload 3 photos in order: 1) BEFORE 2) AFTER 3) NOW.

Create ONE single image collage only:
- 3 equal panels side by side
- Left = BEFORE, Middle = AFTER, Right = NOW
- Use my uploaded photos as-is in each panel
- Keep the SAME face/identity in all panels — do not change, beautify, or replace my face
- Full body visible if present in my photos
- Small labels only: BEFORE | AFTER | NOW
- No long text, no story, no hashtags — only the collage image
```

---

## Full prompt (stricter face lock)

```
You are creating a Wellness Valley transformation collage.

I will upload exactly 3 photos in this order:
1) BEFORE — start of journey
2) AFTER — first transformation result
3) NOW — current look

OUTPUT RULES (mandatory):
- Return ONLY one image file (a single collage). Do not make long explanations the main output.
- Layout: three equal vertical panels side by side on one canvas.
- Panel order left → right: BEFORE | AFTER | NOW.
- Put a small label on each panel: BEFORE, AFTER, NOW.
- Place each uploaded photo into its matching panel. Prefer the original photo content.
- FACE LOCK: Keep the same person’s face and identity in every panel. Do not swap faces, do not redesign facial features, do not beautify into a different person, do not age/gender-swap.
- Body/clothing may show natural progress between panels, but face must remain recognizably the same as the uploads.
- Prefer full-body framing when the uploads are full-body.
- Clean simple background; no extra people; no watermarks; no medical claims text.
- If a photo is unusable (extreme crop, face hidden, wrong person), say in one short line what to retake — then still do not invent a new face.

Do not output hashtags, stories, or multi-section text reports.
Generate the collage now from my 3 uploads.
```

---

## Rules users must follow

| Rule | Why |
|------|-----|
| Same person in all 3 photos | Face lock only works if identity matches |
| Upload order: Before → After → Now | Wrong order mislabels panels |
| Full-body preferred | Matches Transformation share style |
| Reject if face changes | Regenerate with Full prompt |
| One collage only | Not three separate images |

---

## How this relates to the app

| Outside ChatGPT | Inside app (Mine Transformation) |
|-----------------|----------------------------------|
| Build Before \| After \| Now collage | **One collage upload slot** |
| Download the single image | Tap **Copy ChatGPT prompt** → then Gallery / Paste collage |
| Share collage on WhatsApp / Instagram | Share card shows the collage as one image |

Weights (Before kg / After kg) stay editable under the collage.

---

## Acceptance check

- [ ] One image downloaded (not three)
- [ ] Labels: BEFORE \| AFTER \| NOW
- [ ] Same face across all three panels
- [ ] No long caption block as the main result
