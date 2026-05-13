// Required-fields checklist shown above the form.
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const CompleteProfileChecklist = ({ loading, checks }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-4 shadow-sm flex-wrap">
    {loading ? (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-transparent" />
        Checking required profile fields...
      </div>
    ) : checks.length === 0 ? (
      <div className="text-sm text-green-700 font-medium">All required fields are already complete.</div>
    ) : (
      checks.map((f) => (
        <div key={f.label} className="flex items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${f.done ? 'text-green-500' : 'text-gray-300'}`} />
          <span className={`text-xs font-medium ${f.done ? 'text-green-700 line-through' : 'text-gray-500'}`}>
            {f.label}
          </span>
        </div>
      ))
    )}
  </div>
);

export default CompleteProfileChecklist;
