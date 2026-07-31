# ADR-0005 — Nutrition Knowledge Base

**Status:** Accepted  
**Date:** 2026-07-30  
**Owners:** @nutrition-team, @principal-eng  
**Flag:** `ff.nutrition-knowledge`

## Context

Manual food entry only persists 5 macros. AI photo analysis returns up to 26 nutrition fields, but those micros are stripped from food-history search. We need a path that (1) reuses known nutrition without burning AI credits, and (2) grows an owned master catalog so AI usage declines over time — without depending on USDA/Nutritionix.

## Decision

Lookup priority for food search / resolve:

1. **Master nutrition DB** (`nutrition_master_profiles_table`) — free, shared, approved profiles  
2. **Prior AI `AnalysisData`** (user then community history) — free bridge  
3. **Manual 5 macros** — free  
4. **AI enrichment** (text or image, user opt-in via AI Mode) — **1 credit only on successful analysis**

Successful AI food analyses upsert a **draft** master candidate (`status=draft`). Promotion to `approved` is admin-reviewed (or a future auto-promote rule). Seeded brand/common foods ship as `approved`.

## Consequences

- New VSA feature: `backend/features/nutrition-knowledge/`
- Food-corrections search merges master hits when the flag is ON and returns full micros from history
- Cross-feature: `background-analysis` calls public `recordAiFoodCandidate` after a successful food save
- Requires ADR because it spans nutrition search, AI credits, and diary persistence
