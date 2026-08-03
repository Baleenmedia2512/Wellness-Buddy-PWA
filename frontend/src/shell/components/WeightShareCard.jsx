/**
 * shell/components/WeightShareCard.jsx
 * ---------------------------------------------------------------------------
 * Off-screen weight-analysis share card rendered at x=-9999px so that
 * precaptureShareImage (html2canvas) can paint it to a JPEG during idle time.
 * The cached JPEG is shared to WhatsApp instantly when the user taps Share,
 * with no html2canvas latency on the tap path.
 *
 * Extracted from App.js (2026-07-16) \xe2\x80\x94 JSX is byte-identical.
 *
 * Props:
 *   user            \xe2\x80\x94 Firebase/OTP user object (email, displayName, photoURL)
 *   savedUserName   \xe2\x80\x94 display name from profile (overrides user.displayName)
 *   savedProfileImage \xe2\x80\x94 custom uploaded profile image (base64)
 *   sharePhotoBase64  \xe2\x80\x94 CORS-safe base64 of the Google photoURL
 *   imagePreview    \xe2\x80\x94 base64 of the weight-scale photo
 *   weightResult    \xe2\x80\x94 { weightValue, unit }
 *   weightDiff      \xe2\x80\x94 { previous, previousDate, change } | null
 *   idealWeight     \xe2\x80\x94 { value, min, unit, heightCm } | null
 * ---------------------------------------------------------------------------
 */
import React, { forwardRef } from 'react';
import { getVersionString } from '../../config/version';

export const WeightShareCard = forwardRef(function WeightShareCard(
  {
    user,
    savedUserName,
    savedProfileImage,
    sharePhotoBase64,
    imagePreview,
    weightResult,
    weightDiff,
    idealWeight,
  },
  ref,
) {
  return (
                <div
                  ref={ref}
                  className="fixed -left-[9999px] top-0"
                  style={{ position: "fixed", left: "-9999px", width: 460 }}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 20,
                      boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
                      border: "2px solid #2dd4bf",
                    }}
                  >
                    {/* User header strip */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "32px 28px",
                        background:
                          "linear-gradient(135deg, #0d9488 0%, #059669 100%)",
                        borderRadius: "18px 18px 0 0",
                        minHeight: 110,
                      }}
                    >
                      {/* Profile photo ? div+backgroundImage for reliable html2canvas rendering */}
                      {savedProfileImage ||
                      sharePhotoBase64 ||
                      user?.photoURL ? (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            border: "3px solid rgba(255,255,255,0.95)",
                            backgroundImage: `url(${
                              savedProfileImage ||
                              sharePhotoBase64 ||
                              user.photoURL
                            })`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            border: "3px solid rgba(255,255,255,0.9)",
                            background: "rgba(255,255,255,0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              color: "white",
                              fontWeight: 800,
                              fontSize: 26,
                              lineHeight: 1,
                            }}
                          >
                            {(user?.displayName || user?.email || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            color: "white",
                            fontWeight: 800,
                            fontSize: 19,
                            lineHeight: 1.2,
                            margin: "0 0 6px 0",
                          }}
                        >
                          {savedUserName ||
                            user?.displayName ||
                            user?.name ||
                            "Wellness User"}
                        </p>
                        <p
                          style={{
                            color: "rgba(187,247,236,0.95)",
                            fontSize: 13,
                            margin: 0,
                            lineHeight: 1,
                          }}
                        >
                          {new Date().toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}{" "}
                          {new Date().toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p
                        style={{
                          color: "rgba(187,247,236,0.85)",
                          fontSize: 16,
                          margin: 0,
                          lineHeight: 1,
                          alignSelf: "flex-end",
                          flexShrink: 0,
                          fontWeight: 600,
                        }}
                      >
                        {getVersionString()}
                      </p>
                    </div>

                    {/* Weight Image for sharing */}
                    {imagePreview && (
                      <div style={{ background: "black", overflow: "hidden" }}>
                        <img
                          src={imagePreview}
                          alt="Weight Scale"
                          style={{
                            width: "100%",
                            height: 256,
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      </div>
                    )}

                    {/* Yesterday Weight label */}
                    {weightDiff && weightDiff.previous != null && (
                      <div
                        style={{
                          background: "linear-gradient(to right, #0d9488, #059669)",
                          color: "white",
                          textAlign: "center",
                          padding: "12px 24px",
                          fontSize: 18,
                          fontWeight: 600,
                        }}
                      >
                        Yesterday: {parseFloat((+weightDiff.previous).toFixed(2))} {weightResult.unit}
                      </div>
                    )}

                    {/* Card content for sharing - Simple and Clean */}
                    <div
                      style={{
                        background: "white",
                        padding: 32,
                        borderRadius: "0 0 18px 18px",
                      }}
                    >
                      <h2
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#059669",
                          textAlign: "center",
                          margin: "0 0 24px 0",
                        }}
                      >
                        Weight Analysis
                      </h2>

                      <div
                        style={{
                          background: "#f5f3ff",
                          borderRadius: 16,
                          padding: 24,
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#7c3aed",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            margin: "0 0 8px 0",
                          }}
                        >
                          Weight
                        </p>
                        <p
                          style={{
                            fontSize: 48,
                            fontWeight: 700,
                            color: "#6d28d9",
                            margin: 0,
                            lineHeight: 1.1,
                          }}
                        >
                          {parseFloat((+weightResult.weightValue).toFixed(2))}
                          <span
                            style={{
                              fontSize: 22,
                              fontWeight: 400,
                              marginLeft: 8,
                            }}
                          >
                            {weightResult.unit}
                          </span>
                        </p>
                      </div>

                      {/* Ideal Weight Strip (share card) */}
                      {idealWeight && (
                        <div
                          style={{
                            marginTop: 16,
                            borderRadius: 16,
                            padding: "14px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#2563eb",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                margin: "0 0 4px 0",
                              }}
                            >
                              Ideal Weight
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#6b7280",
                                margin: 0,
                              }}
                            >
                              Based on height {idealWeight.heightCm} cm
                            </p>
                          </div>
                          <div style={{ textAlign: "right", color: "#1d4ed8" }}>
                            <p
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                margin: 0,
                              }}
                            >
                              {(() => {
                                const current = weightResult?.weightValue;
                                const isLoss =
                                  current && current > idealWeight.value + 0.5;
                                const isGain =
                                  current && current < idealWeight.min - 0.5;
                                if (isLoss)
                                  return `${idealWeight.value} ${idealWeight.unit}`;
                                if (isGain)
                                  return `${idealWeight.min} ${idealWeight.unit}`;
                                return `${idealWeight.value} ${idealWeight.unit}`;
                              })()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Weight Diff Strip */}
                      {weightDiff && (
                        <div
                          style={{
                            marginTop: 20,
                            borderRadius: 16,
                            padding: "14px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background:
                              weightDiff.change < 0
                                ? "#f0fdf4"
                                : weightDiff.change > 0
                                ? "#fff1f2"
                                : "#f9fafb",
                            border: `1px solid ${
                              weightDiff.change < 0
                                ? "#bbf7d0"
                                : weightDiff.change > 0
                                ? "#fecdd3"
                                : "#e5e7eb"
                            }`,
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#6b7280",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                margin: "0 0 4px 0",
                              }}
                            >
                              vs Previous
                            </p>
                            <p
                              style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#374151",
                                margin: "0 0 2px 0",
                              }}
                            >
                              {weightDiff.previous} {weightResult.unit}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                margin: 0,
                              }}
                            >
                              {new Date(
                                weightDiff.previousDate,
                              ).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                              })}
                            </p>
                          </div>
                          <div
                            style={{
                              textAlign: "right",
                              color:
                                weightDiff.change < 0
                                  ? "#16a34a"
                                  : weightDiff.change > 0
                                  ? "#ef4444"
                                  : "#6b7280",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 22,
                                fontWeight: 700,
                                margin: "0 0 2px 0",
                              }}
                            >
                              {weightDiff.change > 0
                                ? "?"
                                : weightDiff.change < 0
                                ? "?"
                                : "�"}{" "}
                              {weightDiff.change === 0
                                ? "No change"
                                : Math.abs(weightDiff.change) < 1
                                ? `${Math.round(
                                    Math.abs(weightDiff.change) * 1000,
                                  )} g`
                                : `${Math.abs(weightDiff.change).toFixed(2)} ${
                                    weightResult.unit
                                  }`}
                            </p>
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              {weightDiff.change < 0
                                ? "Lost"
                                : weightDiff.change > 0
                                ? "Gained"
                                : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
});

