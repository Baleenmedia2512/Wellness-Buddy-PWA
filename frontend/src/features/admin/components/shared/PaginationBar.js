/**
 * PaginationBar.js — page navigation + items-per-page dropdown.
 *
 * Pure presentational. All state lives in the parent's `usePagination`
 * hook; this component just renders + emits callbacks.
 */
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const VisiblePageNumbers = ({ totalPages, currentPage }) =>
  Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1),
  );

const PageButton = ({ page, currentPage, onClick }) => (
  <button onClick={() => onClick(page)} aria-current={currentPage === page ? 'page' : undefined}
    className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all ${
      currentPage === page ? 'bg-green-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
    }`}>{page}</button>
);

export default function PaginationBar({
  currentPage, totalPages, itemsPerPage, startIndex, endIndex, totalItems,
  goPrev, goNext, goPage, changePageSize,
}) {
  const [openDropdown, setOpenDropdown] = useState(false);
  const visiblePages = VisiblePageNumbers({ totalPages, currentPage });

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/30 overflow-visible">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
          <button onClick={goPrev} disabled={currentPage === 1} aria-label="Previous page"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            {visiblePages.map((page, i, arr) => (
              <React.Fragment key={page}>
                {i > 0 && arr[i - 1] !== page - 1 && <span className="px-1.5 text-gray-400 text-sm select-none">•••</span>}
                <PageButton page={page} currentPage={currentPage} onClick={goPage} />
              </React.Fragment>
            ))}
          </div>
          <button onClick={goNext} disabled={currentPage === totalPages} aria-label="Next page"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems}
          </span>
          <span className="text-gray-400">|</span>
          <label className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
          <div className="relative">
            <button type="button" onClick={() => setOpenDropdown((o) => !o)}
              className="text-sm border-2 border-gray-300 rounded-lg px-3 py-1.5 bg-white flex items-center gap-2 min-w-[70px] justify-between hover:border-gray-400 transition-colors">
              <span className="font-medium">{itemsPerPage}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${openDropdown ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown && (
              <div className="fixed inset-0 z-[999]" onClick={() => setOpenDropdown(false)}>
                <div className="absolute bg-white border-2 border-gray-200 rounded-lg shadow-2xl min-w-[100px] overflow-hidden"
                  style={{ bottom: '60px', right: '16px' }} onClick={(e) => e.stopPropagation()}>
                  {PAGE_SIZE_OPTIONS.map((value) => (
                    <button key={value} type="button"
                      onClick={() => { changePageSize(value); setOpenDropdown(false); }}
                      className={`w-full px-4 py-3 text-sm text-left flex items-center justify-between border-b border-gray-100 last:border-b-0 ${
                        itemsPerPage === value ? 'bg-green-500 text-white font-bold' : 'text-gray-700 hover:bg-green-50'
                      }`}>
                      <span>{value}</span>
                      {itemsPerPage === value && <Check className="w-5 h-5" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
