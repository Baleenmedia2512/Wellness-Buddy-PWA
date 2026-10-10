/**
 * Nutrition Knowledge Base (ADR-0005)
 *
 * Owned master nutrition profiles + resolve/search/enrich APIs.
 * Lookup priority for clients: master → prior AI history → manual macros → AI enrich.
 *
 * APIs:
 *   GET  /api/nutrition-knowledge/resolve?name=&weightG=
 *   GET  /api/nutrition-knowledge/search?query=
 *   POST /api/nutrition-knowledge/enrich   (AI text enrich + credit gate)
 *   POST /api/nutrition-knowledge/approve  (promote draft → approved)
 *   POST /api/nutrition-knowledge/custom-food  (user name + g|ml + serving; no macros)
 *
 * Migration: backend/migrations/create_nutrition_master_profiles_table.sql
 * In-code seeds (Banana, Apple, Idli, Herbalife Shake, Afresh, Omelette, Onion)
 * apply when the table is missing so local/dev still returns master hits.
 *
 * Custom food (Manual Log): POST custom-food writes status=approved, source=user_manual,
 * empty nutrition {}, reference_weight_g + is_liquid from serving. Dedupe by normalized_name.
 */
