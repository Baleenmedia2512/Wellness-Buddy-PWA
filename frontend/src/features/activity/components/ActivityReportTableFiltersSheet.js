import React, { useEffect, useMemo, useState } from 'react';
import { Filter, X, Check } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  ACTIVITY_REPORT_TABLE_FILTER_COLUMNS,
  emptyActivityReportTableFilterValues,
  formatActivityReportFilterOption,
  normalizeActivityReportTableFilters,
  toggleActivityReportFilterValue,
} from '../utils/activityReportTableFilters';

/**
 * Single-scroll filter sheet: pick multiple parameters (and multiple values
 * per parameter) in one place, then Apply.
 */
export default function ActivityReportTableFiltersSheet({
  isOpen,
  onClose,
  appliedFilters,
  availableFilters,
  onApply,
  disabled = false,
}) {
  const [draft, setDraft] = useState(() => emptyActivityReportTableFilterValues());

  useEffect(() => {
    if (!isOpen) return undefined;
    setDraft(normalizeActivityReportTableFilters(appliedFilters));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, appliedFilters]);

  const draftCount = useMemo(
    () => ACTIVITY_REPORT_TABLE_FILTER_COLUMNS.reduce(
      (sum, column) => sum + (draft[column.id]?.length || 0),
      0,
    ),
    [draft],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="More filters">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[78vh] flex flex-col safe-bottom">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-green-700" />
            <h3 className="text-sm font-bold text-gray-900">More filters</h3>
            {draftCount > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-green-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {draftCount}
              </span>
            )}
          </div>
          <TouchFeedbackButton
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100"
            ariaLabel="Close filters"
          >
            <X className="w-4 h-4 text-gray-500" />
          </TouchFeedbackButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <p className="text-[11px] text-gray-500">
            Select multiple filters at once. Tap again to deselect.
          </p>
          {ACTIVITY_REPORT_TABLE_FILTER_COLUMNS.map((column) => {
            const options = availableFilters?.[column.id] || [];
            const selected = draft[column.id] || [];
            return (
              <section key={column.id} aria-label={column.label}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="text-xs font-bold text-gray-800">{column.label}</h4>
                  {selected.length > 0 ? (
                    <TouchFeedbackButton
                      onClick={() => setDraft((prev) => ({ ...prev, [column.id]: [] }))}
                      className="text-[10px] font-semibold text-gray-500 hover:text-gray-800"
                    >
                      Clear
                    </TouchFeedbackButton>
                  ) : null}
                </div>
                {options.length === 0 ? (
                  <p className="text-[11px] text-gray-400 py-1">No values yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                      const isSelected = selected.includes(String(option));
                      return (
                        <TouchFeedbackButton
                          key={option}
                          onClick={() => {
                            setDraft((prev) => toggleActivityReportFilterValue(prev, column.id, option));
                          }}
                          disabled={disabled}
                          ariaLabel={`${isSelected ? 'Remove' : 'Add'} ${column.label} ${formatActivityReportFilterOption(column.id, option)}`}
                          className={`inline-flex items-center gap-1 max-w-full px-2.5 py-1.5 rounded-full border text-[11px] font-semibold ${
                            isSelected
                              ? 'border-green-600 bg-green-50 text-green-800'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {isSelected ? <Check className="w-3 h-3 flex-shrink-0" /> : null}
                          <span className="truncate">
                            {formatActivityReportFilterOption(column.id, option)}
                          </span>
                        </TouchFeedbackButton>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-white">
          <TouchFeedbackButton
            onClick={() => setDraft(emptyActivityReportTableFilterValues())}
            disabled={disabled || draftCount === 0}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40"
          >
            Clear all
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={() => {
              onApply?.(normalizeActivityReportTableFilters(draft));
              onClose?.();
            }}
            disabled={disabled}
            className="flex-[1.4] inline-flex items-center justify-center py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold shadow-sm disabled:opacity-50"
          >
            Apply{draftCount > 0 ? ` (${draftCount})` : ''}
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
}
