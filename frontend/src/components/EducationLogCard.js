import React from 'react';
import { GraduationCap, Monitor, FileText, Clock, CheckCircle2 } from 'lucide-react';

const EducationLogCard = ({ educationData }) => {
  if (!educationData) return null;

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-purple-100/50 p-6 mb-6 animate-slideInUp border border-purple-50">
      {/* Success Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center ring-4 ring-purple-50">
          <GraduationCap className="w-7 h-7 text-purple-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Education Logged</h3>
          <p className="text-sm text-gray-500 font-medium">You're building a great learning habit!</p>
        </div>
      </div>

      {/* Meeting Details */}
      <div className="space-y-4 bg-gray-50/80 rounded-2xl p-5 border border-gray-100">
        {/* Topic */}
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 mt-0.5">
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Topic</p>
            <p className="text-sm font-bold text-gray-900">{educationData.topic}</p>
          </div>
        </div>

        {/* Platform */}
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 mt-0.5">
            <Monitor className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Platform</p>
            <p className="text-sm font-bold text-gray-900">{educationData.platform}</p>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-start gap-3.5">
          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 mt-0.5">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Logged At</p>
            <p className="text-sm font-bold text-gray-900">
              {new Date().toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <div className="mt-5 flex items-center gap-3 bg-emerald-50/80 border border-emerald-100 rounded-xl p-4">
        <div className="bg-emerald-100 rounded-full p-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-sm text-emerald-800 font-semibold">
          Your session has been verified and saved
        </p>
      </div>
    </div>
  );
};

export default EducationLogCard;
