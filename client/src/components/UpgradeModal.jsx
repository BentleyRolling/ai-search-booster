import React from 'react';
import { X, Crown, Zap, TrendingUp, CheckCircle, Sparkles, Infinity } from 'lucide-react';

const UpgradeModal = ({ isVisible, onClose, currentTier = 'Free' }) => {
  if (!isVisible) return null;

  const plans = [
    {
      name: 'Starter',
      price: '$9',
      period: '/month',
      description: 'Perfect for small stores getting started',
      optimizations: '250',
      features: [
        'Auto-optimization for all content types',
        '250 optimizations per month',
        'Advanced SEO improvements',
        'Automated content enhancement',
        'Priority email support'
      ],
      color: 'blue',
      recommended: currentTier === 'Free'
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'Best for growing businesses',
      optimizations: '1,000',
      features: [
        'Everything in Starter',
        '1,000 optimizations per month',
        'Advanced analytics and insights',
        'Custom optimization rules',
        'Priority support with live chat',
        'A/B testing capabilities'
      ],
      color: 'green',
      recommended: currentTier === 'Starter'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large-scale operations',
      optimizations: 'Unlimited',
      features: [
        'Everything in Pro',
        'Unlimited optimizations',
        'Custom integrations',
        'Dedicated account manager',
        'Phone support',
        'Custom SLA'
      ],
      color: 'purple',
      recommended: currentTier === 'Pro'
    }
  ];

  const handleSelectPlan = (planName) => {
    // Navigate to Shopify billing/upgrade page
    window.open('https://partners.shopify.com/current/app_charges', '_blank');
    onClose();
  };

  const getColorClasses = (color, variant = 'primary') => {
    const colors = {
      blue: {
        primary: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        border: 'border-blue-500',
        text: 'text-blue-400',
        bg: 'bg-blue-600/20'
      },
      green: {
        primary: 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
        border: 'border-green-500',
        text: 'text-green-400',
        bg: 'bg-green-600/20'
      },
      purple: {
        primary: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
        border: 'border-purple-500',
        text: 'text-purple-400',
        bg: 'bg-purple-600/20'
      }
    };
    return colors[color][variant];
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#2d2d2d] border border-gray-600 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600 sticky top-0 bg-[#2d2d2d] z-10">
          <div className="flex items-center space-x-3">
            <Crown className="w-7 h-7 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
              <p className="text-gray-400 text-sm">Unlock the full power of AI Search Booster</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current Plan Banner */}
        {currentTier !== 'Free' && (
          <div className="bg-[#1e1e1e] border-b border-gray-600 p-4">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Current Plan: {currentTier}</span>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-[#1e1e1e] border rounded-xl p-6 transition-all duration-200 hover:shadow-lg
                  ${plan.recommended 
                    ? `${getColorClasses(plan.color, 'border')} shadow-lg` 
                    : 'border-gray-600 hover:border-gray-500'
                  }
                `}
              >
                {/* Recommended Badge */}
                {plan.recommended && (
                  <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r ${getColorClasses(plan.color)} px-4 py-1 rounded-full text-white text-xs font-medium`}>
                    Recommended
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-400 ml-1">{plan.period}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                {/* Optimizations Highlight */}
                <div className={`${getColorClasses(plan.color, 'bg')} border ${getColorClasses(plan.color, 'border')} rounded-lg p-4 mb-6`}>
                  <div className="flex items-center justify-center space-x-2">
                    {plan.optimizations === 'Unlimited' ? (
                      <Infinity className={`w-5 h-5 ${getColorClasses(plan.color, 'text')}`} />
                    ) : (
                      <Zap className={`w-5 h-5 ${getColorClasses(plan.color, 'text')}`} />
                    )}
                    <span className="text-white font-semibold">{plan.optimizations}</span>
                    <span className="text-gray-300">optimizations/month</span>
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2
                    ${currentTier === plan.name 
                      ? 'bg-gray-600 text-gray-300 cursor-default'
                      : plan.recommended
                        ? `bg-gradient-to-r ${getColorClasses(plan.color)} text-white`
                        : 'bg-transparent border border-gray-500 text-white hover:bg-gray-700'
                    }
                  `}
                  disabled={currentTier === plan.name}
                >
                  {currentTier === plan.name ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Current Plan</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Select {plan.name}</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm mb-4">
              All plans include a 7-day free trial. Cancel anytime.
            </p>
            <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
              <span>✓ 30-day money-back guarantee</span>
              <span>✓ No setup fees</span>
              <span>✓ Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;