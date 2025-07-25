import React, { useState } from 'react';
import { Zap, Crown, X, Sparkles, TrendingUp, Unlock } from 'lucide-react';

const AutoOptimizeToggle = ({ 
  enabled, 
  loading, 
  tier, 
  onToggle,
  onUpgrade
}) => {
  const [showModal, setShowModal] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  
  const isFree = tier === 'Free';

  const handleClick = () => {
    if (isFree) {
      setShowModal(true);
    } else {
      setShowModal(true); // Show activation modal for paid tiers too
    }
  };

  const handleActivate = () => {
    if (!isFree) {
      onToggle(!enabled);
    }
    setShowModal(false);
  };

  const handleUpgradeClick = () => {
    setShowModal(false);
    if (onUpgrade) {
      onUpgrade();
    }
  };

  return (
    <>
      {/* Auto-Optimize Button */}
      <button
        onClick={handleClick}
        disabled={loading}
        className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 
          ${isFree 
            ? 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:border-gray-500' 
            : enabled
              ? 'bg-green-600/20 text-green-300 border border-green-500 hover:bg-green-600/30'
              : 'bg-transparent text-white border border-white/20 hover:border-gray-400'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        title={isFree ? "Upgrade to Activate" : enabled ? "Auto-Optimize Active" : "Click to Activate Auto-Optimize"}
      >
        {isFree ? (
          <>
            <Crown className="w-4 h-4" />
            <span>Auto-Optimize</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>{enabled ? 'Auto-Optimize ON' : 'Auto-Optimize'}</span>
          </>
        )}
      </button>

      {/* Tooltip */}
      {tooltipVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg border border-gray-600 whitespace-nowrap z-50">
          {isFree ? "Upgrade to Activate" : enabled ? "Auto-optimization is active" : "Click to activate auto-optimization"}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-xl max-w-lg w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-600">
              <div className="flex items-center space-x-3">
                {isFree ? (
                  <>
                    <Crown className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-xl font-semibold text-white">Premium Feature</h3>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white">
                      {enabled ? 'Disable Auto-Optimization' : 'Enable Auto-Optimization'}
                    </h3>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isFree ? (
                // Free Tier Upsell Content
                <>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    <strong className="text-white">Auto-Optimization</strong> automatically optimizes all new content as soon as it's published in your Shopify store - saving you hours of manual work.
                  </p>
                  
                  <div className="bg-[#1e1e1e] border border-gray-600 rounded-lg p-5 mb-6">
                    <h4 className="text-white font-medium mb-3 flex items-center">
                      <Sparkles className="w-5 h-5 text-yellow-500 mr-2" />
                      What you'll get:
                    </h4>
                    <ul className="text-gray-300 space-y-2">
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        Automatic optimization of new products
                      </li>
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        Automatic blog post optimization
                      </li>
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        Automatic collection optimization
                      </li>
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        Automatic page optimization
                      </li>
                      <li className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" />
                        Higher monthly optimization limits
                      </li>
                    </ul>
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-6">
                    Upgrade to <strong className="text-blue-400">Starter</strong> or <strong className="text-green-400">Pro</strong> to unlock automation and dramatically increase your productivity.
                  </p>
                </>
              ) : (
                // Paid Tier Activation Content
                <>
                  <p className="text-gray-300 mb-6 leading-relaxed">
                    {enabled 
                      ? "Auto-optimization is currently active. Disabling it will stop automatic optimization of new content."
                      : "Enable auto-optimization to automatically optimize all new content as it's published in your Shopify store."
                    }
                  </p>
                  
                  <div className="bg-[#1e1e1e] border border-gray-600 rounded-lg p-5 mb-6">
                    <h4 className="text-white font-medium mb-3 flex items-center">
                      <Zap className="w-5 h-5 text-blue-400 mr-2" />
                      {enabled ? 'Currently Active:' : 'What will happen:'}
                    </h4>
                    <ul className="text-gray-300 space-y-2">
                      <li className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${enabled ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                        New products will be {enabled ? 'automatically' : 'auto-'} optimized
                      </li>
                      <li className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${enabled ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                        New blog posts will be {enabled ? 'automatically' : 'auto-'} optimized
                      </li>
                      <li className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${enabled ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                        New collections will be {enabled ? 'automatically' : 'auto-'} optimized
                      </li>
                      <li className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-3 ${enabled ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                        New pages will be {enabled ? 'automatically' : 'auto-'} optimized
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 p-6 border-t border-gray-600">
              {isFree ? (
                <>
                  <button
                    onClick={handleUpgradeClick}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>View Plans</span>
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 border border-gray-500 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleActivate}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2
                      ${enabled 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                      }
                    `}
                  >
                    <Zap className="w-4 h-4" />
                    <span>{enabled ? 'Disable' : 'Enable'} Auto-Optimize</span>
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 border border-gray-500 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AutoOptimizeToggle;