/**
 * frontend/src/features/captures/components/UnknownShareViewer.jsx
 * ---------------------------------------------------------------------------
 * PR-E / ADR-0003 — full-screen viewer shown when a share link points at an
 * `unknown` capture (AI could not classify the image).
 *
 * Layout mirrors an "opened" food card minus the nutrition rows: the image
 * fills the card; Retry + Edit + Delete actions sit below it. The buttons
 * render ONLY when `canMutate` is true (owner or a coach in the owner's
 * upline — decided server-side and passed in by the parent). Anonymous link
 * recipients see the image only.
 *
 * Pure presentational — owns no async. The parent (App.js / UnknownEntryFlow) wires:
 *   - onRetry  : re-run Gemini on the image, then promote unknown → food.
 *   - onEdit   : open SmartFoodSearchModal, then promote with the picked food.
 *   - onDelete : soft-delete the capture (2026-06-09).
 *   - onClose  : dismiss the viewer.
 * ---------------------------------------------------------------------------
 */

import React from 'react';

function UnknownShareViewer({
  isOpen,
  imageBase64,
  canMutate = false,
  retrying = false,
  error = null,
  onRetry,
  onEdit,
  onDelete,
  onClose,
}) {
  if (!isOpen) return null;

  const imgSrc = imageBase64
    ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unknown-share-title"
      data-testid="unknown-share-viewer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2
            id="unknown-share-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            Unrecognised photo
          </h2>
          <button
            type="button"
            aria-label="Close"
            data-testid="unknown-share-close"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <p className="px-5 pt-1 text-sm text-gray-600 dark:text-gray-400">
          We couldn&apos;t tell what this image is.
          {canMutate ? ' Retry the analysis or edit it manually.' : ''}
        </p>

        <div className="px-5 py-4">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt="Shared capture"
              data-testid="unknown-share-image"
              className="w-full rounded-xl object-cover"
            />
          ) : (
            <div
              data-testid="unknown-share-image-missing"
              className="flex h-48 w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 dark:bg-gray-800"
            >
              Image unavailable
            </div>
          )}
        </div>

        {error ? (
          <p
            data-testid="unknown-share-error"
            className="px-5 pb-2 text-sm text-red-600"
          >
            {error}
          </p>
        ) : null}

        {canMutate ? (
          <div className="flex flex-col gap-2 px-5 pb-8">
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="unknown-share-retry"
                disabled={retrying}
                onClick={onRetry}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retrying ? 'Retrying…' : 'Retry'}
              </button>
              <button
                type="button"
                data-testid="unknown-share-edit"
                disabled={retrying}
                onClick={onEdit}
                className="flex-1 rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-gray-800"
              >
                Edit
              </button>
            </div>
            <button
              type="button"
              data-testid="unknown-share-delete"
              disabled={retrying}
              onClick={onDelete}
              className="w-full rounded-lg border border-red-600 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-gray-800"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default UnknownShareViewer;
