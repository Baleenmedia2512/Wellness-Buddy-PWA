/**
 * EducationLogContent.js — presentational.
 * Inner content of the "Education Logged" card. Shared between the visible
 * card and the off-screen share-image capture.
 */
import React from 'react';
import { GraduationCap, Monitor, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { formatLoggedAtFull } from '../services/educationFormatter';

export default function EducationLogContent({ educationData, headline, successMessage }) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center ring-4 ring-purple-50">
          <GraduationCap className="w-7 h-7 text-purple-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Education Logged</h3>
          <p className="text-sm text-gray-500 font-medium">{headline}</p>
        </div>
      </div>

      <div className="space-y-4 bg-gray-50/80 rounded-2xl p-5 border border-gray-100">
        <DetailRow icon={FileText} iconColor="text-indigo-600" label="Topic" value={educationData.topic} />
        <DetailRow icon={Monitor} iconColor="text-purple-600" label="Platform" value={educationData.platform} />
        <DetailRow icon={Clock} iconColor="text-blue-600" label="Logged At" value={formatLoggedAtFull(educationData.loggedAt)} />
      </div>

      <div className="mt-5 flex items-center gap-3 bg-emerald-50/80 border border-emerald-100 rounded-xl p-4">
        <div className="bg-emerald-100 rounded-full p-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-sm text-emerald-800 font-semibold">{successMessage}</p>
      </div>
    </>
  );
}

function DetailRow({ icon: Icon, iconColor, label, value }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 mt-0.5">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
