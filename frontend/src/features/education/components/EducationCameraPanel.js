/**
 * EducationCameraPanel.js — empty-state upload prompt.
 *
 * The dashboard does not own the camera/upload flow directly (that
 * lives in `EducationActionButtons` + manual entry modal); this panel
 * is the user-facing prompt shown when there are no logs yet, telling
 * them to capture/upload meeting screenshots.
 */
import React from 'react';
import { BookOpen } from 'lucide-react';

export const EducationEmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 px-4">
    <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <BookOpen className="w-10 h-10 text-purple-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No Education Logs Yet</h3>
      <p className="text-gray-600 mb-4">
        Upload meeting screenshots to automatically track your education sessions
      </p>
    </div>
  </div>
);

const EducationCameraPanel = () => (
  <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
    <div className="text-6xl mb-4">📚</div>
    <h3 className="text-xl font-semibold text-gray-800 mb-2">No Education Sessions</h3>
    <p className="text-gray-500 text-sm max-w-xs mx-auto">
      Upload meeting screenshots to automatically track your education sessions.
    </p>
  </div>
);

export default EducationCameraPanel;
