import React from 'react';
import { Crown } from 'lucide-react';

const QuotaToast = ({ isVisible, usageCount, monthlyLimit, tier }) => {
  if (!isVisible) return null;

  const isFree = tier === 'Free';

  const handleUpgrade = () => {
    window.open('https://partners.shopify.com/current/app_charges', '_blank');
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-gray-900 border border-red-500 rounded-lg p-4 shadow-lg max-w-sm backdrop-blur-sm animate-fade-in">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 text-red-400">
              ⚠️
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-white">
              {isFree 
                ? "You've reached your monthly optimization limit" 
                : "You've reached your optimization limit for this month"
              }
            </p>
            <p className="text-xs text-red-300 mt-1">
              {usageCount}/{monthlyLimit} optimizations used
            </p>
            {isFree && (
              <>
                <p className="text-xs text-yellow-300 mt-2">
                  Upgrade to continue optimizing your content and unlock automation.
                </p>
                <button
                  onClick={handleUpgrade}
                  className="mt-2 flex items-center space-x-1 text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-md hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                >
                  <Crown className="w-3 h-3" />
                  <span>Upgrade Plan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotaToast;