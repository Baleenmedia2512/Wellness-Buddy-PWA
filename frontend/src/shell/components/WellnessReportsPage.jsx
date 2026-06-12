/**
 * WellnessReportsPage.jsx — summary + trend charts for nutrition, weight,
 * and education. Kept separate from the Diary (log lists / meal entries).
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import TouchFeedbackButton from '../../shared/components/TouchFeedbackButton';
import TeamMemberProfileModal from '../../shared/components/TeamMemberProfileModal';
import { TeamMemberSearch } from '../../features/team';
import DiarySummaryCards from './DiarySummaryCards';

export default function WellnessReportsPage({
  user,
  userRole = 'user',
  onBack,
  apiBaseUrl,
  bmrUpdateKey = 0,
  educationRefreshKey = 0,
  watchBurnedCalories = 0,
  initialSelectedMember = null,
}) {
  const [selectedMember, setSelectedMember] = useState(initialSelectedMember);
  const [showMemberProfile, setShowMemberProfile] = useState(false);

  useEffect(() => {
    if (initialSelectedMember === undefined) return;
    setSelectedMember(initialSelectedMember);
  }, [initialSelectedMember]);

  const displayUser = selectedMember || user;
  const selectedDate = new Date();

  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: '#e8f5e9' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl" />
        </div>

        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
          <TeamMemberSearch
            user={user}
            userRole={userRole}
            selectedMember={selectedMember}
            onMemberSelect={setSelectedMember}
          />

          <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
            <div className="flex items-center justify-between p-4 md:p-6 pb-3">
              <TouchFeedbackButton
                onClick={onBack}
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                ariaLabel="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </TouchFeedbackButton>

              <div className="text-center flex-1 px-2">
                <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                  Reports
                  {selectedMember && !selectedMember.isSelf ? (
                    <>
                      {' - '}
                      <button
                        type="button"
                        onClick={() => setShowMemberProfile(true)}
                        className="text-blue-600 active:text-green-600 hover:text-blue-700 hover:underline transition-colors"
                        title="View profile"
                      >
                        {selectedMember.userName}
                      </button>
                    </>
                  ) : null}
                </h1>
                <p className="text-xs text-gray-500">
                  {selectedMember && !selectedMember.isSelf ? (
                    <button
                      type="button"
                      onClick={() => setShowMemberProfile(true)}
                      className="text-blue-600 active:text-green-600 hover:underline"
                    >
                      {`Viewing ${selectedMember.userName}'s summary & trends`}
                    </button>
                  ) : (
                    'Summary & trends'
                  )}
                </p>
              </div>

              <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="relative px-3 md:px-4 pb-24">
          <DiarySummaryCards
            user={displayUser}
            apiBaseUrl={apiBaseUrl}
            selectedDate={selectedDate}
            bmrUpdateKey={bmrUpdateKey}
            educationRefreshKey={educationRefreshKey}
            watchBurnedCalories={watchBurnedCalories}
          />
        </div>
      </div>

      {selectedMember && !selectedMember.isSelf && (
        <TeamMemberProfileModal
          isOpen={showMemberProfile}
          onClose={() => setShowMemberProfile(false)}
          memberEmail={selectedMember.email}
          apiBaseUrl={apiBaseUrl}
        />
      )}
    </>
  );
}
