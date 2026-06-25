// Top-of-screen sliding face-detection toast.
import React from 'react';
import { Loader, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const STYLES = {
  detecting: { bar: 'bg-blue-400', icon: 'text-blue-500', title: 'Verifying photo...', sub: 'AI is checking your profile photo.', Icon: Loader, spin: true },
  face_found: { bar: 'bg-green-500', icon: 'text-green-500', title: 'Face verified!', sub: 'Your photo is ready to save.', Icon: CheckCircle },
  no_face: { bar: 'bg-red-500', icon: 'text-red-500', title: 'No face detected', sub: 'Upload a clear photo of your face.', Icon: XCircle },
  detection_error: { bar: 'bg-amber-400', icon: 'text-amber-500', title: 'Verification failed', sub: 'Please try a different photo.', Icon: AlertCircle },
};

const FaceDetectionToast = ({ status, visible, onDismiss }) => {
  if (!visible || status === 'idle' || !STYLES[status]) return null;
  const s = STYLES[status];
  const { Icon } = s;
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-white rounded-2xl w-[92%] max-w-xs animate-[fadeSlideDown_0.25s_ease-out] overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
      <div className={`self-stretch w-1 flex-shrink-0 rounded-l-2xl ${s.bar}`} />
      <div className={`flex-shrink-0 ${s.icon}`}>
        <Icon className={`w-5 h-5 ${s.spin ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0 py-3 pr-1">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{s.title}</p>
        <p className="text-[11px] mt-0.5 text-gray-500 leading-snug">{s.sub}</p>
      </div>
      {status !== 'detecting' && (
        <button onClick={onDismiss}
          className="flex-shrink-0 w-8 h-8 mr-2 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      )}
    </div>
  );
};

export default FaceDetectionToast;
