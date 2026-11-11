import React, { useRef, useState } from 'react';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { compressPortfolioImage } from '../utils/compressPortfolioImage';

/**
 * Form previews run on the CRA/Capacitor origin. MilesWeb redirects are often
 * `/api/media/...` and must hit the backend host, not the frontend host.
 */
export function resolvePortfolioMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    try {
      return `${getApiBaseUrl()}${trimmed}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function FieldLabel({ children, required, hint }) {
  return (
    <div className="mb-1.5">
      <label className="block text-[13px] font-semibold tracking-wide text-slate-800">
        {children}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

const controlClass =
  'w-full rounded-2xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60';

export function TextInput({ value, onChange, placeholder, type = 'text', disabled = false }) {
  return (
    <input
      type={type}
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={type === 'time' ? 'off' : undefined}
      className={controlClass}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3, disabled = false }) {
  return (
    <textarea
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${controlClass} resize-y min-h-[88px]`}
    />
  );
}

export function SelectInput({ value, onChange, options, placeholder = 'Select', disabled = false }) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${controlClass} appearance-none`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

export function MultiCheck({ options, value = [], onChange, disabled = false }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt) => {
    if (disabled) return;
    if (selected.includes(opt)) onChange(selected.filter((v) => v !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3.5 py-2 text-left text-[13px] font-medium transition ${
              active
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50'
            } disabled:opacity-60`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function YesNo({ value, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100/80 p-1">
      {['yes', 'no'].map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold capitalize transition ${
              active
                ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-100'
                : 'text-slate-600 hover:text-slate-900'
            } disabled:opacity-60`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function FormCard({ title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      {(title || subtitle) ? (
        <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-3.5">
          {title ? <h2 className="text-[15px] font-bold text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

export function FieldBlock({ children }) {
  return <div className="space-y-1.5">{children}</div>;
}

/**
 * Intro video(s) → FTP upload via onUpload(file).
 * Pass values + onChangeMultiple for unlimited videos; videoUrl/onClear for legacy single.
 */
export function VideoUploadField({
  label,
  videoUrl,
  values,
  onChangeMultiple,
  disabled = false,
  onUpload,
  onClear,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const multiple = typeof onChangeMultiple === 'function';
  const list = multiple
    ? (Array.isArray(values) ? values : []).filter(Boolean)
    : (videoUrl ? [videoUrl] : []);

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || typeof onUpload !== 'function' || disabled) return;
    setBusy(true);
    setError('');
    try {
      if (multiple) {
        const next = [...list];
        for (const file of files) {
          const uploaded = await onUpload(file);
          const url = typeof uploaded === 'string' ? uploaded : (uploaded?.url || null);
          if (url) next.push(url);
        }
        onChangeMultiple?.(next);
      } else {
        await onUpload(files[0]);
      }
    } catch (err) {
      setError(err?.message || 'Video upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <FieldLabel hint={multiple ? 'Add as many intro videos as you need' : undefined}>{label}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        multiple={multiple}
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-4 text-sm font-semibold text-emerald-800 disabled:opacity-60"
      >
        {busy
          ? 'Uploading to FTP…'
          : multiple
            ? (list.length ? `Add more videos (${list.length})` : 'Upload intro videos')
            : (list.length ? 'Replace intro video' : 'Upload intro video')}
      </button>
      <p className="text-[11px] text-slate-500">MP4 / WebM / MOV · max 80 MB each · stored on FTP</p>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {list.length ? (
        <div className="space-y-3">
          {list.map((src, idx) => {
            const previewUrl = resolvePortfolioMediaUrl(src) || src;
            return (
              <div key={`${idx}-${String(src).slice(0, 32)}`} className="space-y-2">
                <video
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-48 w-full rounded-2xl border border-slate-200 bg-black"
                />
                <button
                  type="button"
                  disabled={disabled || busy}
                  className="text-xs font-semibold text-rose-600"
                  onClick={() => {
                    if (multiple) {
                      onChangeMultiple?.(list.filter((_, i) => i !== idx));
                    } else {
                      onClear?.();
                    }
                  }}
                >
                  Remove video
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

async function dataUrlToJpegFile(dataUrl, name = 'photo.jpg') {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

/**
 * Photo picker. If onUpload is provided → compress then FTP upload and store returned URL.
 * Without onUpload → stores compressed data URL (legacy / offline).
 * Multiple albums have no count cap — coaches may add as many photos as needed.
 */
export function PhotoField({
  label,
  value,
  onChange,
  multiple = false,
  values = [],
  onChangeMultiple,
  disabled = false,
  onUpload,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = (Array.isArray(values) ? values : []).filter(Boolean);

  const resolveOne = async (file) => {
    const dataUrl = await compressPortfolioImage(file);
    if (typeof onUpload !== 'function') return dataUrl;
    const compressed = await dataUrlToJpegFile(dataUrl, file.name || 'photo.jpg');
    const uploaded = await onUpload(compressed);
    if (typeof uploaded === 'string') return uploaded;
    return uploaded?.url || dataUrl;
  };

  const onPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || disabled) return;
    setBusy(true);
    setError('');
    try {
      if (multiple) {
        const next = [...list];
        for (const file of files) {
          next.push(await resolveOne(file));
        }
        onChangeMultiple?.(next);
      } else {
        onChange?.(await resolveOne(files[0]));
      }
    } catch (err) {
      setError(err?.message || 'Image upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <FieldLabel hint={multiple ? 'Add as many photos as you need' : undefined}>{label}</FieldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-4 text-sm font-semibold text-emerald-800 disabled:opacity-60"
      >
        {busy
          ? (onUpload ? 'Uploading…' : 'Compressing…')
          : multiple
            ? (list.length ? `Add more photos (${list.length})` : 'Add photos')
            : 'Upload photo'}
      </button>
      {onUpload ? (
        <p className="text-[11px] text-slate-500">
          JPG / PNG / WEBP · compressed · stored on wellnessvalley FTP
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {!multiple && value ? (
        <div className="relative inline-block">
          <img
            src={resolvePortfolioMediaUrl(value) || value}
            alt=""
            className="h-24 w-24 rounded-2xl object-cover border border-slate-200 bg-slate-100"
          />
          <button
            type="button"
            disabled={disabled || busy}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow"
            onClick={() => onChange?.(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {multiple && list.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {list.map((src, idx) => (
            <div key={`${idx}-${String(src).slice(0, 24)}`} className="relative">
              <img
                src={resolvePortfolioMediaUrl(src) || src}
                alt=""
                className="h-20 w-20 rounded-2xl object-cover border border-slate-200 bg-slate-100"
              />
              <button
                type="button"
                disabled={disabled || busy}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow"
                onClick={() => onChangeMultiple?.(list.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
