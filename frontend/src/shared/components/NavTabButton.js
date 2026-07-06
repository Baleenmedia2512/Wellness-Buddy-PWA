// Shared responsive nav tab — fits iPhone SE (320px) through Pro Max.
import React from 'react';
import TouchFeedbackButton from './TouchFeedbackButton';

const NavTabButton = ({
  onClick,
  active,
  activeBg = 'bg-green-100',
  hoverBg = 'hover:bg-green-50',
  icon: Icon,
  iconActiveClass = 'text-green-800',
  iconClass = 'text-green-700',
  labelActiveClass = 'text-green-900',
  labelClass = 'text-green-800',
  label,
  ariaLabel,
}) => (
  <TouchFeedbackButton
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-0.5 px-1 xxs:px-1.5 xs:px-2.5 py-1.5 xs:py-2 rounded-xl transition-colors shrink-0 min-w-[40px] xxs:min-w-[44px] xs:min-w-[48px] ${
      active ? activeBg : hoverBg
    }`}
    ariaLabel={ariaLabel || label}
  >
    <Icon className={`h-4 w-4 xs:h-5 xs:w-5 ${active ? iconActiveClass : iconClass}`} />
    <span className={`text-[9px] xxs:text-[10px] font-semibold leading-tight text-center ${active ? labelActiveClass : labelClass}`}>
      {label}
    </span>
  </TouchFeedbackButton>
);

export default NavTabButton;
