import React from 'react';

const DashboardSkeleton = () => {
  return (
    <div className="p-8 animate-pulse space-y-8">
      {/* Page Header Skeleton */}
      <div className="flex justify-between items-end mb-6">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-48 bg-gray-200 rounded-md"></div>
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-xl"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-32 w-full flex flex-col justify-between">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <div className="h-8 w-32 bg-gray-200 rounded-lg"></div>
            <div className="h-3 w-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Content Section Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-200 rounded"></div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50">
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 flex-1 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="h-4 flex-1 bg-gray-100 rounded"></div>
                <div className="h-4 w-24 bg-gray-100 rounded"></div>
                <div className="h-8 w-20 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
