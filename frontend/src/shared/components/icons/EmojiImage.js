// Colored emoji image for iOS WebView (native emoji renders as ? on iOS).
// Uses bundled Twemoji SVG assets in public/emoji/.
import React from 'react';
import { isIOS } from '../../utils/platform';
import { emojiAssetUrl } from '../../utils/emojiAsset';

const EmojiImage = ({ emoji, className = 'w-5 h-5', alt = '' }) => {
  const src = emojiAssetUrl(emoji);
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      aria-hidden={alt ? undefined : true}
      className={`inline-block object-contain select-none flex-shrink-0 ${className}`}
    />
  );
};

/** Renders a colored emoji image on iOS, native emoji character elsewhere. */
export const EmojiOrNative = ({ emoji, className = 'w-5 h-5', nativeClassName = 'text-lg' }) => {
  if (!emoji) return null;
  if (isIOS()) {
    return <EmojiImage emoji={emoji} className={className} />;
  }
  return <span className={nativeClassName} aria-hidden="true">{emoji}</span>;
};

export default EmojiImage;
