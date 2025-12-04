// src/components/UserProfileModal.js
import React, { useState, useEffect } from 'react';
import { X, User, Save, CheckCircle, Flame } from 'lucide-react';

/**
 * User Profile Modal
 * Displays user information and allows editing profile fields
 */
const UserProfileModal = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [bmr, setBmr] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Fetch user profile when modal opens
  useEffect(() => {
    if (isOpen && user?.email) {
      // Reset states when modal opens
      setSuccessMessage('');
      setHasSaved(false);
      setError('');
      fetchUserProfile();
    }
  }, [isOpen, user?.email]);

  // Auto-dismiss success message after 10 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(
        `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();

      if (data.success && data.data) {
        const profile = data.data;
        setName(profile.userName || user.name || '');
        setHeight(profile.height ? String(profile.height) : '');
        setBmr(profile.latestBmr ? String(Math.round(profile.latestBmr)) : '');
      }
    } catch (err) {
      console.error('❌ Error fetching user profile:', err);
      // Fall back to user object data
      setName(user?.name || '');
      setHeight('');
      setBmr('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setSuccessMessage('');
      setIsSaving(true);

      // Validate inputs
      if (height && (parseFloat(height) < 50 || parseFloat(height) > 198)) {
        setError('Height must be between 50 and 198 cm (max 6.5 feet)');
        setIsSaving(false);
        return;
      }

      // Validate BMR if provided
      if (bmr && bmr.trim() !== '') {
        const bmrValue = parseFloat(bmr);
        if (isNaN(bmrValue) || bmrValue < 1100 || bmrValue > 2200) {
          setError('BMR must be between 1100 and 2200 kcal/day');
          setIsSaving(false);
          return;
        }
      }

      // Add 5 second delay before saving
      await new Promise(resolve => setTimeout(resolve, 3000));

      const response = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          name: name || undefined,
          height: height ? parseFloat(height) : undefined,
          bmr: bmr && bmr.trim() !== '' ? parseFloat(bmr) : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      if (data.success) {
        // Update BMR if it was recalculated
        if (data.data?.bmr) {
          setBmr(String(Math.round(data.data.bmr)));
        }
        
        // Notify parent component of the update
        if (onProfileUpdate) {
          onProfileUpdate({
            name,
            height: height ? parseFloat(height) : null,
            bmr: data.data?.bmr || (bmr ? parseFloat(bmr) : null),
          });
        }
        
        // Show success message and keep modal open
        setSuccessMessage('Profile saved successfully!');
        setHasSaved(true);
      } else {
        throw new Error(data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('❌ Error updating profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Prevent closing modal while saving is in progress
    if (isSaving) return;
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header with User Photo and Name */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || user.name || 'User'}
                className="w-12 h-12 rounded-full border-2 border-green-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-800">{name || user?.displayName || user?.name || 'User'}</h2>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                     Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: '16px' }}
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g., 183 (6 feet)"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: '16px' }}
                    min="50"
                    max="198"
                  />
                </div>

                {/* BMR */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      BMR (kcal)
                    </span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bmr}
                    onChange={(e) => setBmr(e.target.value)}
                    placeholder="e.g., 1650"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: '16px' }}
                    min="1100"
                    max="2200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Basal Metabolic Rate (1100 - 2200 kcal/day)
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {successMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isLoading && (
          <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              {hasSaved ? 'Close' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
