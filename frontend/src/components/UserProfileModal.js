// src/components/UserProfileModal.js
import React, { useState, useEffect, useRef } from 'react';
import { X, User, Save, CheckCircle, Flame, ChevronDown } from 'lucide-react';
import { getUserContext } from '../services/userContextService';
import TouchFeedbackButton from './TouchFeedbackButton';

/**
 * User Profile Modal
 * Displays user information and allows editing profile fields
 */
const UserProfileModal = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [bmr, setBmr] = useState('');
  const [dietType, setDietType] = useState('');
  const [isDietDropdownOpen, setIsDietDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSaved, setHasSaved] = useState(false);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const dropdownOptionsRef = useRef(null);
  const modalContentRef = useRef(null);

  // Auto-scroll to show all dropdown options when dropdown opens
  useEffect(() => {
    if (isDietDropdownOpen && dropdownOptionsRef.current && modalContentRef.current) {
      setTimeout(() => {
        // Scroll to the dropdown options to ensure they're fully visible
        dropdownOptionsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end', // Align to bottom to show all options
          inline: 'nearest'
        });
      }, 100);
    }
  }, [isDietDropdownOpen]);

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

  // Auto-dismiss success message and close modal after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, onClose]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      setError('');

      const cacheBuster = Date.now();
      const response = await fetch(
        `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
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
        setDietType(profile.dietType || '');
      }
    } catch (err) {
      console.error('❌ Error fetching user profile:', err);
      // Fall back to user object data
      setName(user?.name || '');
      setHeight('');
      setBmr('');
      setDietType('');
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
          dietType: dietType || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to update profile');
      }

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
            dietType: dietType || null,
          });
        }
        
        // Refresh user context to update AI personalization (especially diet preference)
        if (user?.id) {
          console.log('🔄 [Profile Update] Refreshing user context...');
          getUserContext(user.id)
            .then(() => console.log('✅ [Profile Update] User context refreshed'))
            .catch(error => console.error('❌ [Profile Update] Failed to refresh context:', error));
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
      <div 
        ref={modalContentRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
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
          <TouchFeedbackButton
            onClick={handleCancel}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            ariaLabel="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </TouchFeedbackButton>
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

                {/* Diet Preference - Custom Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Diet Preference
                  </label>
                  
                  {/* Dropdown Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsDietDropdownOpen(!isDietDropdownOpen)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-left transition-all hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-base truncate">
                        {dietType ? (
                          <>
                            {dietType === 'Vegetarian' && '🌱 Vegetarian'}
                            {dietType === 'Non-Vegetarian' && '🍗 Non-Vegetarian'}
                            {dietType === 'Vegan' && '🥦 Vegan'}
                            {dietType === 'Pescatarian' && '🐟 Pescatarian'}
                          </>
                        ) : (
                          <span className="text-gray-400">Select diet type</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown 
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                        isDietDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Options */}
                  {isDietDropdownOpen && (
                    <div 
                      ref={dropdownOptionsRef}
                      className="absolute z-50 w-full mt-2 bg-white rounded-xl border-2 border-gray-300 shadow-lg overflow-hidden"
                    >
                      {[
                        { value: 'Vegetarian', label: '🌱 Vegetarian', desc: 'No meat or fish' },
                        { value: 'Non-Vegetarian', label: '🍗 Non-Vegetarian', desc: 'Includes all foods' },
                        { value: 'Vegan', label: '🥦 Vegan', desc: 'No animal products' },
                        { value: 'Pescatarian', label: '🐟 Pescatarian', desc: 'Fish but no meat' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setDietType(option.value);
                            setIsDietDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 transition-all text-left border-b border-gray-100 last:border-b-0 ${
                            dietType === option.value
                              ? 'bg-green-50 text-green-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base">{option.label}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
                            </div>
                            {dietType === option.value && (
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    AI will prioritize foods matching your diet preference
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
            <TouchFeedbackButton
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              ariaLabel="Cancel"
            >
              <X className="w-5 h-5" />
              {hasSaved ? 'Close' : 'Cancel'}
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              ariaLabel="Save profile"
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
            </TouchFeedbackButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
