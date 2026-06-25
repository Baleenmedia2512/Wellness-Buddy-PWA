// Body of UserProfileModal — renders fields, cards, dropdown, and messages.
import React from 'react';
import { CheckCircle } from 'lucide-react';
import UserProfileFields from './UserProfileFields';
import IdealWeightCards from './IdealWeightCards';
import DietDropdown from './DietDropdown';
import TaskAverageTimesCard from './TaskAverageTimesCard';

const UserProfileBody = ({ isLoading, form, latestWeight, error, successMessage, taskAverages, averagesLoading }) => (
  <div className="p-6 space-y-5">
    {isLoading ? (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent" />
      </div>
    ) : (
      <>
        <UserProfileFields name={form.name} setName={form.setName}
          height={form.height} setHeight={form.setHeight}
          phone={form.phone} setPhone={form.setPhone}
          bmr={form.bmr} setBmr={form.setBmr} />
        <IdealWeightCards height={form.height} latestWeight={latestWeight} />
        <TaskAverageTimesCard averages={taskAverages} loading={averagesLoading} />
        <DietDropdown value={form.dietType} onChange={form.setDietType} />
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
