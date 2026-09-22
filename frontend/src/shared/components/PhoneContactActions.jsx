import React from 'react';
import { Phone } from 'lucide-react';
import { isCallablePhone } from '../domain/phoneContact.js';
import { openPhoneCall, openWhatsAppChat } from '../utils/phoneContactActions.js';

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654c1.746.943 3.71 1.444 5.687 1.445h.005c6.554 0 11.89-5.335 11.893-11.893C23.947 5.334 18.604 0 12.05 0zm0 21.785h-.004c-1.774 0-3.513-.477-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374c-.99-1.574-1.512-3.393-1.511-5.26.003-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898 1.866 1.869 2.893 4.352 2.89 6.992-.003 5.45-4.435 9.884-9.883 9.884z" />
    </svg>
  );
}

const SIZE = {
  sm: {
    iconBtn: 'w-7 h-7',
    icon: 'h-3.5 w-3.5',
    number: 'text-sm',
    gap: 'gap-1.5',
  },
  md: {
    iconBtn: 'w-9 h-9',
    icon: 'h-4 w-4',
    number: 'text-sm font-semibold',
    gap: 'gap-2',
  },
};

/**
 * Read-only phone number with Call and WhatsApp actions.
 *
 * @param {object} props
 * @param {unknown} props.phone
 * @param {boolean} [props.showNumber=true]
 * @param {'sm'|'md'} [props.size='md']
 * @param {string} [props.className]
 * @param {string} [props.numberClassName]
 * @param {string} [props.fallback='—']
 * @param {boolean} [props.stopPropagation=false]
 */
export default function PhoneContactActions({
  phone,
  showNumber = true,
  size = 'md',
  className = '',
  numberClassName = '',
  fallback = '—',
  stopPropagation = false,
}) {
  const callable = isCallablePhone(phone);
  const display = String(phone || '').trim();
  const s = SIZE[size] || SIZE.md;

  const wrapClick = (fn) => (e) => {
    if (stopPropagation) e.stopPropagation();
    fn();
  };

  if (!callable) {
    if (!showNumber) return null;
    const label = String(phone || '').trim();
    const isPlaceholder = !label || /^(n\/?a|—|-)$/i.test(label);
    return (
      <span className={`${s.number} text-gray-500 ${numberClassName}`.trim()}>
        {isPlaceholder ? fallback : label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${s.gap} min-w-0 whitespace-nowrap ${className}`.trim()}>
      {showNumber ? (
        <span className={`${s.number} text-gray-800 truncate ${numberClassName}`.trim()}>
          {display}
        </span>
      ) : null}
      <button
        type="button"
        onClick={wrapClick(() => openPhoneCall(phone))}
        className={`${s.iconBtn} flex-shrink-0 rounded-full bg-green-50 border border-green-300 text-green-700 flex items-center justify-center active:bg-green-100`}
        aria-label={`Call ${display}`}
        title="Call"
      >
        <Phone className={s.icon} />
      </button>
      <button
        type="button"
        onClick={wrapClick(() => openWhatsAppChat(phone))}
        className={`${s.iconBtn} flex-shrink-0 rounded-full flex items-center justify-center active:opacity-80`}
        style={{ backgroundColor: '#e7faf0', border: '1px solid #25D366', color: '#128C7E' }}
        aria-label={`WhatsApp ${display}`}
        title="WhatsApp"
      >
        <WhatsAppIcon className={s.icon} />
      </button>
    </span>
  );
}
