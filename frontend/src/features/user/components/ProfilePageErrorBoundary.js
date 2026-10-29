// Keeps Home chrome visible if My Profile throws. Does not change the happy path.
import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default class ProfilePageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[ProfilePage] render failed', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-full bg-gray-50 pb-8">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-4 pb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.props.onBack}
              className="p-2 rounded-full text-white"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-white">My Profile</h1>
          </div>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-600">Could not open your profile. Go back and try again.</p>
        </div>
      </div>
    );
  }
}
