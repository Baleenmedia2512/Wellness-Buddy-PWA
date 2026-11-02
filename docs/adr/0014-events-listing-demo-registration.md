# ADR-0014 — Events listing and demo registration

**Status:** Accepted  
**Date:** 2026-11-02  
**Owners:** @principal-eng  
**Flag:** `ff.events` (frontend-only; remove by 2027-01-31)

## Context

The frontend and backend do not currently expose an events listing or event
registration API. The requested page should be available from Home, show
event information, and let a visitor enter their name to see a confirmation.

## Decision

1. Add an Events feature page with explicitly identified sample wellness event
   listings and informational event fields.
2. Provide a Register action beside each listing. Its form asks for a name only
   and displays a demo confirmation; it does not persist or transmit the name.
3. Gate the page with the frontend-only `ff.events` flag, enabled by default.
4. Link the page from Home and integrate it with the existing app history and
   back-button navigation.
5. Replace the sample listings and demo registration only after an events API
   and registration behavior are defined.

## Consequences

- The page is usable without backend or database changes.
- The displayed events are examples, not current or scheduled events.
- Registration is not a real reservation and must not be presented as saved.
- The feature flag should be removed after the listing is connected to its
  production data source or the page is withdrawn.
