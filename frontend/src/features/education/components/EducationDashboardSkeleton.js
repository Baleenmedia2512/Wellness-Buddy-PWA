/**
 * EducationDashboardSkeleton.js — initial loading placeholder.
 */
import React from 'react';

const EducationDashboardSkeleton = () => (
  <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse overflow-x-hidden">
    <div className="px-4 md:px-6">
      <div className="mb-6 mt-2">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="h-3 w-24 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <div className="h-2 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="h-2 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center gap-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                  <div className="h-2 w-4 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              {[...Array(2)].map((_, j) => (
                <div key={j} className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4" style={{ minHeight: 72 }}>
                  <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default EducationDashboardSkeleton;
