// Diet preference dropdown with auto-scroll-into-view.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';
import { DIET_OPTIONS } from '../../services/dietOptions';

const findIcon = (v) => DIET_OPTIONS.find((o) => o.value === v)?.icon || '';

const DietDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const optionsRef = useRef(null);

  useEffect(() => {
    if (open && optionsRef.current) {
      const t = setTimeout(() => {
        optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">Diet Preference</label>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-left flex items-center justify-between">
        <span className={`flex items-center gap-2 ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value && <span>{findIcon(value)}</span>}
          {value || 'Select diet preference'}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div ref={optionsRef}
          className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-300 shadow-lg overflow-hidden">
          {DIET_OPTIONS.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2 ${
                value === opt.value ? 'bg-green-50 text-green-900' : 'text-gray-700'
              }`}>
              <span className="text-lg">{opt.icon}</span>
              <span>{opt.label}</span>
              {value === opt.value && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">AI will prioritize foods matching your diet preference</p>
    </div>
  );
};

export default DietDropdown;
