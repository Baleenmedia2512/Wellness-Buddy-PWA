// Inline status badge for face detection results.
import React from 'react';
import { AlertCircle, CheckCircle, Loader, XCircle } from 'lucide-react';

const FaceStatusBadge = ({ status }) => {
  if (status === 'idle') return null;
  const cfg = {
    detecting:        { cls: 'bg-blue-50 border-blue-200 text-blue-700',     icon: <Loader className="w-4 h-4 animate-spin flex-shrink-0" />, msg: 'Verifying your photo...' },
    face_found:       { cls: 'bg-green-50 border-green-200 text-green-700',  icon: <CheckCircle className="w-4 h-4 flex-shrink-0" />,        msg: 'Face detected — looks good!' },
    no_face:          { cls: 'bg-red-50 border-red-200 text-red-700',        icon: <XCircle className="w-4 h-4 flex-shrink-0" />,            msg: 'No face detected. Please upload a clear photo of your face.' },
    detection_error:  { cls: 'bg-yellow-50 border-yellow-200 text-yellow-700', icon: <AlertCircle className="w-4 h-4 flex-shrink-0" />,      msg: 'Verification service unavailable — your photo looks good. Tap Save to continue.' },
  }[status];
  if (!cfg) return null;
  return (
    <div className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium border ${cfg.cls}`}>
      {cfg.icon}
      <span>{cfg.msg}</span>
    </div>
  );
};

export default FaceStatusBadge;
