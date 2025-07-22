/**
 * AI Search Booster - Production Scoring Utilities
 * Provides hallucination risk assessment and LLM visibility scoring
 * 
 * @author AI Search Booster Team
 * @version 1.0.0
 */

/**
 * Calculate hallucination risk score (0.0-1.0) for optimized content
 * Higher scores indicate higher risk of AI-generated content that diverges from source material
 * 
 * @param {Object} optimizedContent - The AI-generated content
 * @param {Object} originalContent - The original Shopify content
 * @param {Array} keywords - Keywords that should be preserved
 * @returns {number} Risk score between 0.0 and 1.0
 */
function calculateHallucinationRisk(optimizedContent, originalContent, keywords = []) {
  let score = 0;
  
  try {
    const { summary, content, faqs, optimizedDescription, llmDescription } = optimizedContent;
    const { title, body_html, description } = originalContent;
    
    // Risk factor 1: Generic marketing language (0.2 penalty each)
    const marketingPhrases = [
      "best on the market", "award-winning", "top-rated", "perfect for everyone",
      "our #1 product", "industry-leading", "revolutionary", "game-changing",
      "unparalleled quality", "premium quality", "luxury", "exclusive"
    ];
    
    const allText = `${summary} ${content} ${optimizedDescription} ${llmDescription}`.toLowerCase();
    marketingPhrases.forEach(phrase => {
      if (allText.includes(phrase.toLowerCase())) {
        score += 0.2;
      }
    });
    
    // Risk factor 2: Guarantee claims in FAQs (0.2 penalty)
    if (faqs && Array.isArray(faqs)) {
      const hasGuarantees = faqs.some(faq => {
        const question = faq.q || faq.question || '';
        const answer = faq.a || faq.answer || '';
        return (question + answer).toLowerCase().includes('guarantee');
      });
      if (hasGuarantees) score += 0.2;
    }
    
    // Risk factor 3: Excessive expansion from original (0.2 penalty)
    const originalLength = (title || '').length + (body_html || description || '').length;
    const optimizedLength = (summary || '').length + (content || '').length;
    
    if (originalLength > 0 && optimizedLength > originalLength * 3) {
      score += 0.2;
    }
    
    // Risk factor 4: Exact duplication (0.1 penalty)
    if (summary && title && summary.trim().toLowerCase() === title.trim().toLowerCase()) {
      score += 0.1;
    }
    
    // Risk factor 5: Missing keyword grounding (0.2 penalty)
    if (keywords.length > 0) {
      const hasKeywords = keywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        return allText.includes(keywordLower) || 
               (faqs && faqs.some(faq => {
                 const answer = faq.a || faq.answer || '';
                 return answer.toLowerCase().includes(keywordLower);
               }));
      });
      
      if (!hasKeywords) score += 0.2;
    }
    
    // Reward factor: Grounded, consistent language (-0.2 bonus)
    const hasGroundedLanguage = (
      summary && summary.length < 100 && // Concise summary
      !allText.includes('amazing') && 
      !allText.includes('incredible') &&
      !allText.includes('perfect') &&
      (originalContent.title && allText.includes(originalContent.title.toLowerCase().substring(0, 10)))
    );
    
    if (hasGroundedLanguage) score -= 0.2;
    
    // Normalize score to 0.0-1.0 range
    score = Math.min(1.0, Math.max(0.0, score));
    
    return Math.round(score * 100) / 100; // Round to 2 decimal places
    
  } catch (error) {
    console.error('[SCORING] Error calculating hallucination risk:', error);
    return 0.5; // Default to medium risk if calculation fails
  }
}

/**
 * Calculate LLM visibility score (0-100) for optimized content
 * Higher scores indicate better discoverability and usefulness for AI assistants
 * 
 * @param {Object} optimizedContent - The AI-generated content
 * @returns {number} Visibility score between 0 and 100
 */
function calculateVisibilityScore(optimizedContent) {
  let score = 100;
  
  try {
    const { summary, content, llmDescription, faqs, optimizedDescription } = optimizedContent;
    
    // Penalty 1: Missing or N/A fields (10 points each)
    if (!summary || summary === 'N/A' || summary.trim() === '') score -= 10;
    if (!llmDescription || llmDescription === 'N/A' || llmDescription.trim() === '') score -= 10;
    if (!content || content === 'N/A' || content.trim() === '') score -= 10;
    if (!optimizedDescription || optimizedDescription === 'N/A' || optimizedDescription.trim() === '') score -= 10;
    
    // Penalty 2: Insufficient FAQs (10 points)
    if (!faqs || !Array.isArray(faqs) || faqs.length < 2) {
      score -= 10;
    }
    
    // Penalty 3: Missing practical information (10 points)
    const practicalTerms = ['sizing', 'size', 'material', 'best for', 'suitable for', 'care', 'wash', 'fit'];
    const allContent = `${content} ${optimizedDescription} ${llmDescription}`.toLowerCase();
    
    const hasPracticalInfo = practicalTerms.some(term => allContent.includes(term));
    if (!hasPracticalInfo) score -= 10;
    
    // Bonus 1: Rich FAQ content (+5 points for good FAQs)
    if (faqs && Array.isArray(faqs) && faqs.length >= 4) {
      const hasGoodFaqs = faqs.some(faq => {
        const question = faq.q || faq.question || '';
        const answer = faq.a || faq.answer || '';
        return question.length > 10 && answer.length > 20 && 
               !question.toLowerCase().includes('what is') &&
               !answer.includes('N/A');
      });
      if (hasGoodFaqs) score += 5;
    }
    
    // Bonus 2: Technical specificity (+5 points)
    const technicalTerms = ['gsm', 'cotton', 'polyester', 'wool', 'dimensions', 'weight', 'temperature', 'breathable'];
    const hasTechnicalSpecs = technicalTerms.some(term => allContent.includes(term.toLowerCase()));
    if (hasTechnicalSpecs) score += 5;
    
    // Normalize score to 0-100 range
    score = Math.min(100, Math.max(0, score));
    
    return Math.round(score);
    
  } catch (error) {
    console.error('[SCORING] Error calculating visibility score:', error);
    return 50; // Default to medium visibility if calculation fails
  }
}

/**
 * Generate a comprehensive quality assessment for optimized content
 * 
 * @param {Object} optimizedContent - The AI-generated content
 * @param {Object} originalContent - The original Shopify content
 * @param {Array} keywords - Keywords that should be preserved
 * @returns {Object} Complete assessment with scores and metadata
 */
function assessContentQuality(optimizedContent, originalContent, keywords = []) {
  const riskScore = calculateHallucinationRisk(optimizedContent, originalContent, keywords);
  const visibilityScore = calculateVisibilityScore(optimizedContent);
  
  return {
    riskScore,
    visibilityScore,
    isHighRisk: riskScore > 0.7,
    qualityGrade: visibilityScore >= 90 ? 'A' : 
                  visibilityScore >= 80 ? 'B' :
                  visibilityScore >= 70 ? 'C' :
                  visibilityScore >= 60 ? 'D' : 'F',
    recommendations: generateRecommendations(riskScore, visibilityScore),
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate improvement recommendations based on scores
 * 
 * @param {number} riskScore - Hallucination risk score
 * @param {number} visibilityScore - LLM visibility score
 * @returns {Array} Array of recommendation strings
 */
function generateRecommendations(riskScore, visibilityScore) {
  const recommendations = [];
  
  if (riskScore > 0.7) {
    recommendations.push('High hallucination risk detected - consider reverting to original content');
  } else if (riskScore > 0.5) {
    recommendations.push('Moderate hallucination risk - review for generic marketing language');
  }
  
  if (visibilityScore < 60) {
    recommendations.push('Low visibility score - add more practical information and technical details');
  } else if (visibilityScore < 80) {
    recommendations.push('Good visibility - consider adding more FAQs or technical specifications');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Content quality is excellent - ready for publication');
  }
  
  return recommendations;
}

export {
  calculateHallucinationRisk,
  calculateVisibilityScore,
  assessContentQuality,
  generateRecommendations
};