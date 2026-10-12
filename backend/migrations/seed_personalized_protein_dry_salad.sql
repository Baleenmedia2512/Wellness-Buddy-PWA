-- Migration: seed_personalized_protein_dry_salad
-- Upsert Personalized Protein Powder into dry_salad_items_table (Target Nutrition).
-- Serving = 1 scoop (6 g) — canister label Per 6 g.
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
  'Personalized Protein Powder',
  'personalized protein powder',
  '["Personalized Protein","PPP","Protein Powder","Herbalife Personalized Protein","Herbalife Personalized Protein Powder"]'::jsonb,
  6,
  false,
  '1 scoop',
  '{"calories":22.96,"protein":4.96,"carbs":0.24,"fat":0.18,"fiber":0,"sugar":0,"sodium":68,"cholesterol":0}'::jsonb,
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
