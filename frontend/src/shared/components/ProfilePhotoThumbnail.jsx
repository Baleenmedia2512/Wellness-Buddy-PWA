import React, { useEffect, useState } from 'react';
import FullscreenProfilePhotoViewer from './FullscreenProfilePhotoViewer.jsx';

export default function ProfilePhotoThumbnail({
  src,
  alt,
  className,
  imageClassName,
  fallbackClassName,
  fallback,
  onViewProfile,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !imageFailed;

  return (
    <>
      {showImage ? (
        <button
          type="button"
          className={className}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
          aria-label={`View ${alt || 'user'}'s profile photo`}
        >
          <img
            src={src}
            alt={alt}
            className={imageClassName}
            onError={() => setImageFailed(true)}
          />
        </button>
      ) : (
        <div className={fallbackClassName}>{fallback}</div>
      )}
      <FullscreenProfilePhotoViewer
        isOpen={isOpen}
        src={showImage ? src : null}
        alt={alt}
        title={`${alt || 'User'}'s profile photo`}
        onClose={() => setIsOpen(false)}
        onViewProfile={onViewProfile ? () => {
          setIsOpen(false);
          onViewProfile();
        } : undefined}
      />
    </>
  );
}
