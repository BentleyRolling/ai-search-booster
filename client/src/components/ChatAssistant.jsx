import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { faqAssistantData, defaultResponse } from '../data/faqAssistantData';

const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! Ask me anything about AI Search Booster. I can help with features, billing, troubleshooting, and more!",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Advanced string similarity function using Levenshtein-like distance
  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;
    
    // Use character overlap as a fast similarity metric
    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  };

  // Enhanced fuzzy matching with word-level scoring
  const fuzzyMatch = (query, text) => {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const textWords = text.toLowerCase().split(' ');
    
    let totalScore = 0;
    let maxPossibleScore = queryWords.length;
    
    queryWords.forEach(queryWord => {
      let bestWordScore = 0;
      
      textWords.forEach(textWord => {
        if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
          bestWordScore = Math.max(bestWordScore, 1.0);
        } else {
          const similarity = calculateSimilarity(queryWord, textWord);
          bestWordScore = Math.max(bestWordScore, similarity);
        }
      });
      
      totalScore += bestWordScore;
    });
    
    return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  };

  // Advanced search function with confidence scoring
  const findBestAnswer = (userInput) => {
    const query = userInput.toLowerCase().trim();
    
    if (query.length < 3) {
      return defaultResponse;
    }

    let bestMatch = null;
    let bestConfidence = 0;
    const confidenceThreshold = 0.3; // Minimum confidence required

    faqAssistantData.forEach(faq => {
      let confidence = 0;
      
      // 1. Exact question match gets highest priority
      const questionSimilarity = fuzzyMatch(query, faq.q);
      confidence += questionSimilarity * 0.6; // 60% weight for question match
      
      // 2. Keyword matching
      let keywordScore = 0;
      faq.keywords.forEach(keyword => {
        const keywordSimilarity = calculateSimilarity(query, keyword);
        if (keywordSimilarity > 0.7 || query.includes(keyword.toLowerCase())) {
          keywordScore += 1;
        }
      });
      confidence += (keywordScore / faq.keywords.length) * 0.3; // 30% weight for keywords
      
      // 3. Answer content similarity (lower weight)
      const answerSimilarity = fuzzyMatch(query, faq.a);
      confidence += answerSimilarity * 0.1; // 10% weight for answer match
      
      // 4. Bonus for shorter questions (more specific)
      const lengthBonus = Math.max(0, (50 - faq.q.length) / 100);
      confidence += lengthBonus * 0.05;
      
      // 5. Check for exact phrase matches
      if (faq.q.toLowerCase().includes(query) || query.includes(faq.q.toLowerCase())) {
        confidence += 0.2; // Significant bonus for phrase inclusion
      }

      if (confidence > bestConfidence && confidence > confidenceThreshold) {
        bestConfidence = confidence;
        bestMatch = faq;
      }
    });

    // Log confidence for debugging (remove in production)
    if (bestMatch) {
      console.log(`Best match: "${bestMatch.q}" with confidence: ${bestConfidence.toFixed(2)}`);
    }

    return bestMatch ? bestMatch.a : defaultResponse;
  };

  // Get suggestions as user types
  const getSuggestions = (input) => {
    if (input.length < 2) return [];
    
    const matches = faqAssistantData
      .filter(faq => 
        faq.q.toLowerCase().includes(input.toLowerCase()) ||
        faq.keywords.some(keyword => keyword.toLowerCase().includes(input.toLowerCase()))
      )
      .slice(0, 3)
      .map(faq => faq.q);
    
    return matches;
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);
    setSuggestions(getSuggestions(value));
  };

  const handleSendMessage = (messageText = inputText) => {
    if (!messageText.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      text: messageText,
      isBot: false,
      timestamp: new Date()
    };

    // Get bot response
    const botResponse = {
      id: Date.now() + 1,
      text: findBestAnswer(messageText),
      isBot: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage, botResponse]);
    setInputText('');
    setSuggestions([]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputText(suggestion);
    setSuggestions([]);
    handleSendMessage(suggestion);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSuggestions([]);
      setInputText('');
    }
  };

  return (
    <>
      {/* Floating Chat Icon */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className="text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105 group"
          style={{ backgroundColor: '#1e1e1e' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#1e1e1e'}
          title="Chat with AI Search Booster Assistant"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <MessageSquare className="w-6 h-6 group-hover:animate-pulse" />
          )}
        </button>
      </div>

      {/* Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-dark-card border border-dark-border rounded-xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="text-white p-4 rounded-t-xl flex items-center justify-between" style={{ backgroundColor: '#1e1e1e' }}>
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="font-semibold text-sm">AI Search Booster Assistant</h3>
                <p className="text-xs text-gray-300">Ask me anything!</p>
              </div>
            </div>
            <button
              onClick={toggleChat}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-dark-bg scrollbar-dark">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`max-w-[85%] flex ${message.isBot ? 'flex-row' : 'flex-row-reverse'} items-start space-x-2`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.isBot 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-600 text-white'
                  }`}>
                    {message.isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className={`px-3 py-2 rounded-xl ${
                    message.isBot
                      ? 'bg-gray-700 text-gray-100 rounded-bl-none'
                      : 'bg-blue-600 text-white rounded-br-none'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.text}</p>
                    <p className="text-xs mt-1 opacity-60">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="px-4 py-2 border-t border-dark-border bg-dark-bg">
              <p className="text-xs text-gray-400 mb-2">Suggestions:</p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="block w-full text-left text-xs text-gray-300 hover:text-white p-2 rounded hover:bg-gray-700 transition-colors mb-1"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-dark-border bg-dark-card">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about AI Search Booster..."
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Press Enter to send • Try asking about features, billing, or troubleshooting
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;