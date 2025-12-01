// src/components/UserProfileModal.js
import React, { useState, useEffect } from 'react';
import { X, User, Save } from 'lucide-react';

/**
 * User Profile Modal
 * Displays user information and allows editing profile fields
 */
const UserProfileModal = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Fetch user profile when modal opens
  useEffect(() => {
    if (isOpen && user?.email) {
      fetchUserProfile();
    }
  }, [isOpen, user?.email]);

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
        setAge(profile.age ? String(profile.age) : '');
        setGender(profile.gender || '');
        setWeight(profile.latestWeight);
        setBmr(profile.latestBmr);
      }
    } catch (err) {
      console.error('❌ Error fetching user profile:', err);
      // Fall back to user object data
      setName(user?.name || '');
      setHeight('');
      setAge('');
      setGender('');
      setWeight(null);
      setBmr(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError('');
      setIsSaving(true);

      // Validate inputs
      if (height && (parseFloat(height) < 50 || parseFloat(height) > 300)) {
        setError('Height must be between 50 and 300 cm');
        setIsSaving(false);
        return;
      }

      if (age && (parseInt(age) < 1 || parseInt(age) > 150)) {
        setError('Age must be between 1 and 150 years');
        setIsSaving(false);
        return;
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
          age: age ? parseInt(age) : undefined,
          gender: gender || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      if (data.success) {
        // Update BMR if it was recalculated
        if (data.data?.bmr) {
          setBmr(data.data.bmr);
        }
        
        // Notify parent component of the update
        if (onProfileUpdate) {
          onProfileUpdate({
            name,
            height: height ? parseFloat(height) : null,
            age: age ? parseInt(age) : null,
            gender,
            bmr: data.data?.bmr || bmr,
          });
        }
        
        onClose();
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
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
              <p className="text-sm text-gray-500">Update your personal information</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* User Photo, Name, Email Section */}
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || 'User'}
                    className="w-16 h-16 rounded-full border-2 border-purple-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-purple-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-gray-800 truncate">
                    {name || user?.name || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Display Name
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
                    placeholder="e.g., 170"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: '16px' }}
                    min="50"
                    max="300"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Age (years)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g., 30"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: '16px' }}
                    min="1"
                    max="150"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gender
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={gender === 'male'}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-base text-gray-700">Male</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={gender === 'female'}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-base text-gray-700">Female</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Read-only Section: Weight & BMR */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-3">Health Metrics (Read-only)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Current Weight</p>
                    <p className="text-lg font-bold text-gray-800">
                      {weight !== null ? `${weight} kg` : '—'}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">BMR</p>
                    <p className="text-lg font-bold text-gray-800">
                      {bmr !== null ? `${Math.round(bmr)} kcal` : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Weight and BMR are updated automatically when you log your weight.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
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
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
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
