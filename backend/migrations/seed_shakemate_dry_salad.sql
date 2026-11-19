-- Migration: seed_shakemate_dry_salad
-- Upsert Shakemate into dry_salad_items_table (Target Nutrition).
-- Label serving = 27 g (2 scoops). Catalog = 1 scoop (13.5 g) = Per 27 g ÷ 2.
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
  'Shakemate',
  'shakemate',
  '["Shake Mate","ShakeMate","Herbalife Shakemate","Herbalife Shake Mate"]'::jsonb,
  13.5,
  false,
  '1 scoop',
  '{"calories":53,"protein":5.38,"carbs":6.75,"fat":0.5,"fiber":0,"sugar":2.25,"sodium":84.5,"cholesterol":2,"vitamin_d":0.83,"calcium":64.5}'::jsonb,
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
