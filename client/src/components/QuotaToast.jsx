import React from 'react';

const QuotaToast = ({ isVisible, usageCount, monthlyLimit }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-gray-900 border border-red-500 rounded-lg p-4 shadow-lg max-w-sm backdrop-blur-sm animate-fade-in">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 text-red-400">
              ⚠️
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-white">
              You've reached your optimization limit for this month
            </p>
            <p className="text-xs text-red-300 mt-1">
              {usageCount}/{monthlyLimit} optimizations used
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaToast;