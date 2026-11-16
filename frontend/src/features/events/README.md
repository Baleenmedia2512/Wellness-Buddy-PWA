# Events

The Home Events page loads the signed-in creator's events from the existing
events API; it does not display static or sample events. Newly created,
updated, or deleted events appear when the Events page is opened or revisited.
If there are no events, the page displays an empty state. Each Register action
opens a name-only demo form. Registration confirmation is held only in
component state and is not saved or sent to a server.

The page is gated by the frontend-only `ff.events` flag.
