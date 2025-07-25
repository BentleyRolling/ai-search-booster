import React, { useState } from 'react';
import { Zap, Crown, X } from 'lucide-react';

const AutoOptimizeToggle = ({ 
  enabled, 
  loading, 
  tier, 
  onToggle 
}) => {
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  
  const isFree = tier === 'Free';
  const isDisabled = loading || isFree;

  const handleClick = () => {
    if (isFree) {
      setShowUpsellModal(true);
    } else {
      onToggle(!enabled);
    }
  };

  const handleUpgrade = () => {
    // Navigate to billing/upgrade page
    window.open('https://partners.shopify.com/current/app_charges', '_blank');
    setShowUpsellModal(false);
  };

  return (
    <>
      {/* Auto-Optimize Toggle */}
      <div className="relative">
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={handleClick}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <span className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : 'text-white'}`}>
            Auto-Optimize
          </span>
          
          {/* Toggle Switch */}
          <div className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out
            ${enabled && !isFree ? 'bg-green-500' : 'bg-gray-600'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}>
            <span className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
              ${enabled && !isFree ? 'translate-x-6' : 'translate-x-1'}
            `}>
              {isFree && (
                <Crown className="w-3 h-3 text-yellow-500 mt-0.5 ml-0.5" />
              )}
              {!isFree && (
                <Zap className={`w-3 h-3 mt-0.5 ml-0.5 ${enabled ? 'text-green-500' : 'text-gray-400'}`} />
              )}
            </span>
          </div>
        </div>

        {/* Tooltip */}
        {tooltipVisible && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg border border-gray-700 whitespace-nowrap z-50">
            {isFree 
              ? "Auto-optimization is only available on paid plans. Upgrade to automate all new content."
              : enabled 
                ? "Auto-optimization is active - new content will be optimized automatically"
                : "Click to enable auto-optimization for new content"
            }
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>

      {/* Upsell Modal */}
      {showUpsellModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Crown className="w-6 h-6 text-yellow-500" />
                <h3 className="text-lg font-semibold text-white">Premium Feature</h3>
              </div>
              <button
                onClick={() => setShowUpsellModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-white mb-4">
                <strong>Auto-Optimization</strong> is a premium feature that automatically optimizes all new content as soon as it's published in your Shopify store.
              </p>
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-4">
                <h4 className="text-white font-medium mb-2 flex items-center">
                  <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                  What you get:
                </h4>
                <ul className="text-gray-300 text-sm space-y-1 ml-6">
                  <li>• Automatic optimization of new products</li>
                  <li>• Automatic blog post optimization</li>
                  <li>• Automatic collection optimization</li>
                  <li>• Automatic page optimization</li>
                  <li>• Higher monthly optimization limits</li>
                </ul>
              </div>
              <p className="text-gray-300 text-sm">
                Upgrade to the <strong>Starter</strong> or <strong>Pro</strong> plan to unlock automation and save hours of manual work.
              </p>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleUpgrade}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
              >
                Upgrade Plan
              </button>
              <button
                onClick={() => setShowUpsellModal(false)}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AutoOptimizeToggle;