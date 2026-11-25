/**
 * MediaPermissionNeededModal (file kept as CameraPermissionNeededModal for imports).
 *
 * App Store 5.1.1(iv): after Camera/Photos denial, iOS will NOT re-prompt.
 * Show dismissible Settings notice only when the user taps Take Photo / Gallery.
 */
import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

const COPY = {
  camera: {
    title: 'Camera access needed',
    body:
      'Meal photo capture needs Camera access. You can enable it in Settings when you want to use this feature.',
    Icon: Camera,
  },
  photos: {
    title: 'Photos access needed',
    body:
      'Gallery needs Photos access. iOS will not ask again after Don’t Allow — enable Photos in Settings to continue.',
    Icon: ImageIcon,
  },
};

export default function CameraPermissionNeededModal({
  kind = 'camera',
  onOpenSettings,
  onDismiss,
}) {
  const content = COPY[kind] ?? COPY.camera;
  const Icon = content.Icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 20,
          width: '100%',
          maxWidth: 340,
          padding: '28px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <Icon size={32} color="#16a34a" strokeWidth={2} aria-hidden />
        </div>

        <p
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: '#111827',
            textAlign: 'center',
            margin: '0 0 10px',
            lineHeight: 1.35,
          }}
        >
          {content.title}
        </p>

        <p
          style={{
            fontSize: 14,
            color: '#6b7280',
            textAlign: 'center',
            margin: '0 0 22px',
            lineHeight: 1.55,
          }}
        >
          {content.body}
        </p>

        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: 'none',
            background: '#16a34a',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 10,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Open Settings
        </button>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: '1.5px solid #e5e7eb',
            background: 'transparent',
            color: '#374151',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
