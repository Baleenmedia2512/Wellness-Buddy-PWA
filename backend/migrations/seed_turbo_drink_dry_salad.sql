-- Migration: seed_turbo_drink_dry_salad
-- Upsert Turbo Drink into dry_salad_items_table (Target Nutrition).
-- One prepared drink:
--   Formula 1              2 scoops
--   Afresh (generic)       4 scoops
--   Personalized Protein   2 scoops
--   Water                  1 L (reference_weight_g = 1000, is_liquid)
-- Nutrition is the sum of those scoops. Water adds volume only.
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
  'Turbo Drink',
  'turbo drink',
  '["Herbalife Turbo Drink","Turbo","TurboDrink"]'::jsonb,
  1000,
  true,
  '2 scoops Formula 1, 4 scoops Afresh, 2 scoops Personalized Protein, 1 L water',
  '{"calories":122.8,"protein":16.12,"carbs":10.8,"fat":1.56,"fiber":2,"sugar":6.38,"sodium":222,"cholesterol":2,"glycemic_index":0,"vitamin_a":140,"vitamin_c":10,"vitamin_d":1.16,"vitamin_e":3.34,"vitamin_k":0,"vitamin_b1":0.3,"vitamin_b2":0.3,"vitamin_b3":3.34,"vitamin_b6":0.54,"vitamin_b9":40,"vitamin_b12":0.26,"calcium":30,"iron":2.34,"magnesium":33.34,"potassium":173.34,"zinc":1.66,"phosphorus":0}'::jsonb,
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
