# Captures slice — test matrix

claude.md §9.3 mandates a capability × layer matrix per feature.

| Capability                                              | Unit | Integration | E2E | Permissions | Edge cases |
| ------------------------------------------------------- | :--: | :---------: | :-: | :---------: | :--------: |
| `isLowConfidenceFood` predicate (shared/lib)            |  ✅  |     —       | —   |     n/a     |   ✅ (7+)  |
| `tabForImageType` / `TAB_BY_IMAGE_TYPE` (shared/lib)    |  ✅  |     —       | —   |     n/a     |   ✅ (6)   |
| `UnknownCaptureModal` rendering & callbacks             |  ✅  |     —       | ⏳  |     n/a     |   ✅ (4)   |
| App.js: handleImageSelect routes low-confidence → modal |  —   |     ⏳      | ⏳  |     n/a     |   ⏳       |
| App.js: share-link router uses TAB_BY_IMAGE_TYPE        |  —   |     ⏳      | ⏳  |     n/a     |   ⏳       |

Legend: ✅ in this PR · ⏳ deferred to a follow-up PR · — not applicable.

## Edge cases covered by `isLowConfidenceFood` unit tests

1. null / undefined input
2. type !== 'food' (weight, education, smartwatch)
3. `details.defaulted === true` (detector failure path)
4. confidence < 0.4
5. empty `details.foods` array
6. foods present but `details.total.calories === 0`
7. happy path: high-confidence food with real calories
