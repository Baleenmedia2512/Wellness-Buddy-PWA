# Feature Testing Matrix — body-parameters-card

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|---|---|---|---|---|---|
| Create card (form → POST) | ✅ card.schema | ✅ create handler | 🔜 | ✅ canCreateCard | ✅ (name empty, BMI out of range, body age excluded) |
| Share token generation | ✅ card.rules | ✅ DB insert | — | — | ✅ UUID uniqueness, 30-day expiry |
| Public card view (GET by token) | ✅ card.rules | ✅ public handler | 🔜 | ✅ token = capability | ✅ expired, not found, wrong format |
| Profile save on link open | ✅ card.rules + policy | ✅ public POST handler | 🔜 | ✅ userId mismatch → read-only | ✅ no height/bmr on card, weight missing |
| Body Age excluded from profile | ✅ buildProfilePatch | ✅ handler output | — | — | ✅ body_age never in patch |
| Platform store link selection | ✅ platform-store.rules | — | 🔜 | — | ✅ android/ios/web/unknown |
| Share text generation | ✅ buildShareText | — | — | — | ✅ no name, long name |
| Share-card visual report content | ✅ BodyParamsCardPreview | — | 🔜 | — | ✅ label:value layout, bg.png background, flower-icon.png bottom-right, BMI normal/underweight/overweight badges, fat% male(10-20)/female(20-30) healthy/low/high badges, body-age circle+badge, ideal-weight hint, dashes for empty fields |
| Pre-fill setup wizard | — | — | 🔜 | — | ✅ user already has data |
| Editable pre-fill fields | — | — | 🔜 | — | ✅ user changes values before save |
| derivedIdealWeight (BMI-23) | ✅ useBodyParamsCard.auto-calc | — | — | — | ✅ empty height, height < 50 |
| Weight auto-fill from height | ✅ useBodyParamsCard.auto-calc | — | — | — | ✅ manual override blocks auto-fill, resetForm re-enables |
| derivedBmi from height+weight | ✅ useBodyParamsCard.auto-calc | — | — | — | ✅ missing inputs |
| BMI auto-fill from height+weight | ✅ useBodyParamsCard.auto-calc | — | — | — | ✅ manual override blocks auto-fill |
| Fat% hint by gender | ✅ useBodyParamsCard.auto-calc | — | — | — | ✅ Male / Female / no selection |
