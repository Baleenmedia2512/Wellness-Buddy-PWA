import React from 'react';
import { ArrowLeft } from 'lucide-react';
import ScreenTimeCard from '../components/ScreenTimeCard';

const ScreenTimePage = ({ userId, onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Screen Time</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-4">
        <ScreenTimeCard userId={userId} />
      </div>
    </div>
  );
};

export default ScreenTimePage;
