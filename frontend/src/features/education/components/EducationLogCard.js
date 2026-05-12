import React, { useState, useRef } from 'react';
import { GraduationCap, Monitor, FileText, Clock, CheckCircle2, Share2 } from 'lucide-react';
import { captureAndShare } from '../../../shared/utils/shareUtils';
import { getVersionString } from '../../../config/version';

const EducationLogCard = ({ educationData, imagePreview, user, savedUserName, savedProfileImage, sharePhotoBase64 }) => {
  const [isSharing, setIsSharing] = useState(false);
  const shareRef = useRef(null);

  // Handle share button click
  const handleShare = async (e) => {
    // Prevent event propagation and bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Early return if already sharing
    if (isSharing) {
      console.log("âš ï¸ Share already in progress, ignoring duplicate call");
      return;
    }

    if (!shareRef.current) {
      console.error("Share content not found");
      return;
    }

    setIsSharing(true);
    try {
      // Capture and share the card with image + details
      await captureAndShare(shareRef.current, {
        title: `Education Session - ${educationData.topic}`,
        text: "",
        fileName: `wellness-valley-education-${educationData.topic.toLowerCase().replace(/\s+/g, '-')}.png`,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setIsSharing(false);
    }
  };

  if (!educationData) return null;

  return (
    <>
      {/* Hidden container for sharing - includes image + card */}
      <div
        ref={shareRef}
        className="fixed -left-[9999px] top-0 w-[400px]"
        style={{ position: "fixed", left: "-9999px" }}
      >
        <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-300 overflow-hidden">
          {/* Profile header for sharing */}
          <div
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
              padding: "20px 20px 16px 20px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            {(savedProfileImage || sharePhotoBase64 || user?.photoURL) ? (
              <div style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.95)",
                backgroundImage: `url(${savedProfileImage || sharePhotoBase64 || user?.photoURL})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }} />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "white", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
                  {(savedUserName || user?.displayName || user?.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 16, lineHeight: 1.2, margin: "0 0 4px 0" }}>
                {savedUserName || user?.displayName || user?.name || "Wellness User"}
              </p>
              <p style={{ color: "rgba(221,214,254,0.95)", fontSize: 12, margin: 0, lineHeight: 1 }}>
                {new Date().toLocaleDateString(undefined, { dateStyle: "medium" })}{" "}
                {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <p style={{ color: "rgba(221,214,254,0.85)", fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1, alignSelf: "flex-end", flexShrink: 0 }}>
              {getVersionString()}
            </p>
          </div>

          {/* Education Image for sharing */}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Education Meeting"
                className="w-full h-64 object-cover"
              />
              <div className="absolute top-3 right-3 bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                Verified
              </div>
            </div>
          )}

          {/* Card content for sharing */}
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center ring-4 ring-purple-50">
                <GraduationCap className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Education Logged</h3>
                <p className="text-sm text-gray-500 font-medium">Building learning habits!</p>
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
                    {new Date(educationData.loggedAt || Date.now()).toLocaleString('en-US', { 
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
                Session verified and saved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Visible card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-purple-100/50 p-6 mb-6 animate-slideInUp border border-purple-50 relative">
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
              {new Date(educationData.loggedAt || Date.now()).toLocaleString('en-US', { 
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

      {/* Share Button at Bottom - Only show if there's an image */}
      {imagePreview && (
        <button
          onClick={handleShare}
          disabled={isSharing}
          className={`w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
            isSharing
              ? "opacity-50 cursor-not-allowed"
              : "hover:shadow-lg active:scale-[0.98]"
          }`}
          style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
        >
          {isSharing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sharing...</span>
            </>
          ) : (
            <>
              <Share2 className="w-5 h-5" />
              <span>Share Session</span>
            </>
          )}
        </button>
      )}
    </div>
    </>
  );
};

export default EducationLogCard;
