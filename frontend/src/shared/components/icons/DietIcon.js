// Diet preference icon — colored emoji on all platforms.
// iOS WebView can't render native emoji, so we use bundled Twemoji SVG assets.
import React from 'react';
import { DIET_OPTIONS } from '../../../features/user/services/dietOptions';
import { EmojiOrNative } from './EmojiImage';

const findEmoji = (value) => DIET_OPTIONS.find((o) => o.value === value)?.icon || '';

const DietIcon = ({ value, className = 'w-5 h-5', emojiClassName = 'text-lg' }) => {
  if (!value) return null;
  const emoji = findEmoji(value);
  if (!emoji) return null;

  return (
    <EmojiOrNative
      emoji={emoji}
      className={className}
      nativeClassName={emojiClassName}
    />
  );
};

export default DietIcon;
