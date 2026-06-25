/**
 * AdminSkeleton.js — loading placeholder for tab content.
 */
import React from 'react';

const StatBoxSkeleton = () => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
    <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="text-center">
          <div className="h-6 sm:h-8 bg-gray-200 rounded w-16 sm:w-20 mx-auto mb-1 animate-pulse" />
          <div className="flex items-center justify-center space-x-1">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-14 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RowSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-48 mb-1 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
        </div>
      </div>
      <div className="text-right">
        <div className="h-6 bg-gray-200 rounded w-16 mb-1 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-12 animate-pulse" />
      </div>
    </div>
  </div>
);

export default function AdminSkeleton({ rows = 5, showStats = true }) {
  return (
    <>
      {showStats && <StatBoxSkeleton />}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="h-4 bg-gray-200 rounded w-28 animate-pulse mb-3" />
          <div className="flex gap-2">
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse flex-1" />
            <div className="h-10 w-20 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: rows }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </div>
    </>
  );
}
