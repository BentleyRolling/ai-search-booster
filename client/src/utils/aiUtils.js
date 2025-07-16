export function formatSummary(text, maxLength = 150) {
  if (!text) return '';
  
  const cleaned = stripHtml(text);
  if (cleaned.length <= maxLength) return cleaned;
  
  return cleaned.substring(0, maxLength - 3) + '...';
}

export function generateFaqs(text) {
  if (!text) return [];
  
  const cleaned = stripHtml(text);
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  const faqs = [];
  const questionStarters = ['What', 'How', 'Why', 'When', 'Where', 'Can', 'Is'];
  
  sentences.slice(0, 5).forEach((sentence, index) => {
    const starter = questionStarters[index % questionStarters.length];
    const topic = sentence.trim().split(' ').slice(0, 5).join(' ');
    
    faqs.push({
      question: `${starter} ${topic.toLowerCase()}?`,
      answer: sentence.trim()
    });
  });
  
  return faqs;
}

export function stripHtml(html) {
  if (!html) return '';
  
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywords(text, count = 10) {
  const cleaned = stripHtml(text).toLowerCase();
  const words = cleaned.split(/\W+/).filter(word => word.length > 3);
  
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

export function generateStructuredData(product) {
  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.title,
    "description": formatSummary(product.description),
    "sku": product.sku,
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": product.currency || "USD",
      "availability": product.available ? "InStock" : "OutOfStock"
    }
  };
}