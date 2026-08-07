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
 *
 * Migration: backend/migrations/create_nutrition_master_profiles_table.sql
 * In-code seeds (Banana, Apple, Idli, Herbalife Shake, Afresh, Omelette, Onion)
 * apply when the table is missing so local/dev still returns master hits.
 */
