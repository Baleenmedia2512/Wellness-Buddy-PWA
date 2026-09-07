// Public surface of the `user` feature slice.
export { default as Login } from './components/Login';
export { default as ConsentForm } from './components/ConsentForm';
export { default as InactiveUserModal } from './components/InactiveUserModal';
export { default as UserNotFoundModal } from './components/UserNotFoundModal';
export { default as UserProfileModal } from './components/UserProfileModal';
export { default as UserProfilePage } from './components/UserProfilePage';
export { default as CompleteProfilePage } from './components/CompleteProfilePage';
export { default as OnboardingIdentityPage } from './components/OnboardingIdentityPage';
export { default as OnboardingTransformationPhotosPage } from './components/OnboardingTransformationPhotosPage';
export { default as MandatoryProfilePictureModal } from './components/MandatoryProfilePictureModal';
export { default as DeleteAccountModal } from './components/DeleteAccountModal';
export { default as InlineNumericKeypad } from './components/InlineNumericKeypad';
export { default as NumericKeypad } from './components/NumericKeypad';
// Note: identity helpers (getUserId, userContextService) intentionally
// removed from the user feature's public surface. Import them from
// `shared/services/userIdentity` instead — see VSA refactor notes.
