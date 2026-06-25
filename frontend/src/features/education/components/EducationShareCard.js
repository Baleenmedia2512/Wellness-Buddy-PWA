/**
 * EducationShareCard.js — presentational.
 * Off-screen card rendered into a hidden container so html2canvas can
 * capture a clean share image (profile header + screenshot + log content).
 */
import React from 'react';
import EducationLogContent from './EducationLogContent';
import { getVersionString } from '../../../config/version';

export default function EducationShareCard({
  shareRef, educationData, imagePreview, user,
  savedUserName, savedProfileImage, sharePhotoBase64,
}) {
  const avatarSrc = savedProfileImage || sharePhotoBase64 || user?.photoURL;
  const displayName = savedUserName || user?.displayName || user?.name || 'Wellness User';
  const initial = (savedUserName || user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div
      ref={shareRef}
      className="fixed -left-[9999px] top-0 w-[400px]"
      style={{ position: 'fixed', left: '-9999px' }}
    >
      <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-300 overflow-hidden">
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
          padding: '20px 20px 16px 20px',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          {avatarSrc ? (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.95)',
              backgroundImage: `url(${avatarSrc})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{initial}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'white', fontWeight: 800, fontSize: 16, lineHeight: 1.2, margin: '0 0 4px 0' }}>{displayName}</p>
            <p style={{ color: 'rgba(221,214,254,0.95)', fontSize: 12, margin: 0, lineHeight: 1 }}>
              {new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}{' '}
              {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <p style={{ color: 'rgba(221,214,254,0.85)', fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1, alignSelf: 'flex-end', flexShrink: 0 }}>
            {getVersionString()}
          </p>
        </div>

        {imagePreview && (
          <div className="relative">
            <img src={imagePreview} alt="Education Meeting" className="w-full h-64 object-cover" />
            <div className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
              <span className="w-2 h-2 bg-white rounded-full" />
              Verified
            </div>
          </div>
        )}

        <div className="p-6">
          <EducationLogContent
            educationData={educationData}
            headline="Building learning habits!"
            successMessage="Session verified and saved"
          />
        </div>
      </div>
    </div>
  );
}
