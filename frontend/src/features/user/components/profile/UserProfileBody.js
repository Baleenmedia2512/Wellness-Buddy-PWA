// Body of UserProfileModal — renders fields, cards, dropdown, and messages.
import React from 'react';
import { CheckCircle, Mail } from 'lucide-react';
import UserProfileFields from './UserProfileFields';
import CommunityIdField from './CommunityIdField';
import UserProfileBodyMetrics from './UserProfileBodyMetrics';
import IdealWeightCards from './IdealWeightCards';
import DietDropdown from './DietDropdown';
import HealthIssuesFilterSelect from '../../../body-parameters-card/components/HealthIssuesFilterSelect';

const UserProfileBody = ({
  isLoading, form, email, latestWeight, initialWeight, initialWeightDate,
  marathonWeightComparison = null,
  error, successMessage,
}) => (
  <div className="p-6 space-y-5">
    {isLoading ? (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent" />
      </div>
    ) : (
      <>
        <UserProfileFields
          email={email}
          hideEmailField
          hideCommunityIdField
          name={form.name} setName={form.setName}
          height={form.height} setHeight={form.setHeight}
          phone={form.phone} setPhone={form.setPhone}
          gender={form.gender} setGender={form.setGender}
          bmr={form.bmr} setBmr={form.setBmr}
          physicalActivityLevel={form.physicalActivityLevel}
          setPhysicalActivityLevel={form.setPhysicalActivityLevel}
        />
        <DietDropdown value={form.dietType} onChange={form.setDietType} />
        <UserProfileBodyMetrics
          bodyMetrics={form.bodyMetrics}
          gender={form.gender}
          onChange={form.setBodyMetricField}
          heightCm={form.height}
          weightKg={latestWeight}
        />
        <div className="pt-1">
          <HealthIssuesFilterSelect
            value={form.recoveredHealthIssues || []}
            onChange={form.setRecoveredHealthIssues}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="email"
              value={email || ''}
              readOnly
              className="w-full pl-9 pr-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg cursor-not-allowed outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Linked to your sign-in account</p>
        </div>
        <CommunityIdField
          communityId={form.communityId}
          setCommunityId={form.setCommunityId}
        />
        <IdealWeightCards
          height={form.height}
          latestWeight={latestWeight}
          initialWeight={initialWeight}
          initialWeightDate={initialWeightDate}
          marathonWeightComparison={marathonWeightComparison}
        />
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />{successMessage}
          </div>
        )}
      </>
    )}
  </div>
);

export default UserProfileBody;
