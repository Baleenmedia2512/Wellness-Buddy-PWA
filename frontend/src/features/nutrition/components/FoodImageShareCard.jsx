/**
 * FoodImageShareCard
 *
 * Off-screen share template used while the AI nutrition analysis is still
 * running. Renders the same green profile header + food photo block as the
 * full NutritionCard share, but WITHOUT the nutrition breakdown section.
 *
 * The element is positioned far off-screen so html2canvas can paint it into
 * a JPEG that we then share via shareImageWithLink(). The user always gets
 * the same visual template — the only difference is that this version omits
 * the nutrition card portion, and the share URL points at the public viewer
 * which fills in the nutrition data once analysis finishes server-side.
 */
import React, { forwardRef } from "react";
import { getVersionString } from "../../../config/version";

const FoodImageShareCard = forwardRef(function FoodImageShareCard(
  { user, savedUserName, savedProfileImage, sharePhotoBase64, imageSrc },
  ref,
) {
  if (!imageSrc) return null;

  const displayName =
    savedUserName || user?.displayName || user?.name || "Wellness User";
  const avatar = savedProfileImage || sharePhotoBase64 || user?.photoURL;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: "1200px",
        height: "auto",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "2px solid #86efac",
          overflow: "hidden",
        }}
      >
        {/* Profile header — identical to NutritionCard share template */}
        <div
          style={{
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            padding: "32px 32px 28px 32px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
          }}
        >
          {avatar ? (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.95)",
                backgroundImage: `url(${avatar})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
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
                  fontSize: 36,
                  lineHeight: 1,
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                color: "white",
                fontWeight: 800,
                fontSize: 28,
                lineHeight: 1.2,
                margin: "0 0 8px 0",
              }}
            >
              {displayName}
            </p>
            <p
              style={{
                color: "rgba(187,247,236,0.95)",
                fontSize: 20,
                margin: 0,
                lineHeight: 1,
              }}
            >
              {new Date().toLocaleDateString(undefined, { dateStyle: "medium" })}{" "}
              {new Date().toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <p
            style={{
              color: "rgba(187,247,236,0.85)",
              fontSize: 22,
              fontWeight: 600,
              margin: 0,
              lineHeight: 1,
              alignSelf: "flex-end",
              flexShrink: 0,
            }}
          >
            {getVersionString()}
          </p>
        </div>

        {/* Food image — same ultra-high-res block as NutritionCard share */}
        <div style={{ height: "1200px", overflow: "hidden" }}>
          <img
            src={imageSrc}
            alt="Food"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              imageRendering: "crisp-edges",
            }}
            crossOrigin="anonymous"
            loading="eager"
            decoding="sync"
          />
        </div>

        {/* Footer ribbon — keeps brand identity consistent across both
            (pre-analysis) and (post-analysis) share images. */}
        <div
          style={{
            background:
              "linear-gradient(to right, #10b981, #059669)",
            color: "white",
            textAlign: "center",
            padding: "20px 32px",
            fontSize: "26px",
            fontWeight: 600,
          }}
        >
          Tap the link to see the full nutrition breakdown
        </div>
      </div>
    </div>
  );
});

export default FoodImageShareCard;
