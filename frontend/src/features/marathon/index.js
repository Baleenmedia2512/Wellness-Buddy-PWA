/**
 * marathon/index.js — Public surface of the Marathon feature.
 * Import everything from this barrel. Never deep-import feature internals.
 */
export { default as MarathonLeaderCard }        from './components/MarathonLeaderCard.jsx';
export { default as MarathonTeamCard }          from './components/MarathonTeamCard.jsx';
export { default as MarathonShareSheet }        from './components/MarathonShareSheet.jsx';
export { default as MarathonDashboard }         from './components/MarathonDashboard.jsx';
export { default as MarathonLapDashboard }      from './components/MarathonLapDashboard.jsx';
export { default as MarathonLeaderboard }       from './components/MarathonLeaderboard.jsx';
export { default as MarathonRecognitionSplash } from './components/MarathonRecognitionSplash.jsx';
export { useMarathon }                          from './hooks/useMarathon.js';
export {
  createMarathon,
  listMarathons,
  getCardData,
  getMyLaps,
  getLeaderboard,
  getPendingRecognition,
  markRecognitionViewed,
  getAdminConfig,
  saveAdminConfig,
  finalizeDay,
}                                               from './services/marathon.api.js';
export {
  buildShareUrl,
  cardTypeLabel,
  hasLiveData,
  sortParticipantsForDisplay,
}                                               from './domain/marathon.display.js';
