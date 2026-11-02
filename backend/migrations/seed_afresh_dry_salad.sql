-- Migration: seed_afresh_dry_salad
-- Upsert Afresh Target Nutrition rows into dry_salad_items_table.
-- Serving = 1 scoop (1 g powder).
--   • Generic Afresh — existing Manual-Log preset macros (sugar 0.51)
--   • Kashmiri Kahwa — canister label Per 1 g (sugar 0.01, sodium 1 mg)
--   • Elaichi — canister label Per 1 g (sugar 0.11, sodium 1 mg)
--   • Cinnamon — canister label Per 1 g (sugar 0.52, sodium 1 mg)
--   • Lemon — canister label Per 1 g (sugar 0.01, sodium 1 mg)
--   • Peach — canister label Per 1 g (sugar 0.61, sodium 1 mg)
--   • Natural Tulsi — canister label Per 1 g (sugar 0.51, sodium 1 mg)
--   • Ginger — canister label Per 1 g (sugar 0.11, sodium 1 mg)
-- Safe to re-run: ON CONFLICT (normalized_name) updates catalog fields.

INSERT INTO public.dry_salad_items_table (
  canonical_name,
  normalized_name,
  aliases,
  reference_weight_g,
  is_liquid,
  portion_label,
  nutrition,
  source,
  status,
  sightings,
  version,
  updated_at
) VALUES
(
  'Herbalife Afresh Energy Drink',
  'herbalife afresh energy drink',
  '["Afresh","Herbalife Afresh","Afresh Energy Drink","Afresh Energy Drink Mix"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.51,"sodium":0.001,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Kashmiri Kahwa',
  'afresh - kashmiri kahwa',
  '["Afresh Kashmiri Kahwa","Kashmiri Kahwa","Afresh Kahwa","Herbalife Afresh Kashmiri Kahwa"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.01,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Elaichi',
  'afresh - elaichi',
  '["Afresh Elaichi","Elaichi","Afresh Elachi","Elachi","Herbalife Afresh Elaichi"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.11,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Cinnamon',
  'afresh - cinnamon',
  '["Afresh Cinnamon","Cinnamon","Afresh Cinamon","Herbalife Afresh Cinnamon"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.52,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Lemon',
  'afresh - lemon',
  '["Afresh Lemon","Lemon","Herbalife Afresh Lemon"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.01,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Peach',
  'afresh - peach',
  '["Afresh Peach","Peach","Herbalife Afresh Peach"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.61,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Natural Tulsi',
  'afresh - natural tulsi',
  '["Afresh Natural Tulsi","Natural Tulsi","Afresh Tulsi","Tulsi","Herbalife Afresh Natural Tulsi"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.51,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
),
(
  'Afresh - Ginger',
  'afresh - ginger',
  '["Afresh Ginger","Ginger","Herbalife Afresh Ginger"]'::jsonb,
  1,
  true,
  '1 scoop',
  '{"calories":3.52,"protein":0.05,"carbs":0.83,"fat":0,"fiber":0,"sugar":0.11,"sodium":1,"cholesterol":0,"glycemic_index":0,"vitamin_c":0,"potassium":0}'::jsonb,
  'brand_preset',
  'approved',
  0,
  1,
  (now() AT TIME ZONE 'utc')
)
ON CONFLICT (normalized_name) DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  aliases = EXCLUDED.aliases,
  reference_weight_g = EXCLUDED.reference_weight_g,
  is_liquid = EXCLUDED.is_liquid,
  portion_label = EXCLUDED.portion_label,
  nutrition = EXCLUDED.nutrition,
  source = EXCLUDED.source,
  status = EXCLUDED.status,
  version = EXCLUDED.version,
  updated_at = (now() AT TIME ZONE 'utc');
