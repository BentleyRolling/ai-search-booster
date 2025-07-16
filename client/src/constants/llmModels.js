export const LLM_MODELS = [
  {
    label: 'Claude 3 Sonnet',
    value: 'claude-3-sonnet',
    provider: 'anthropic',
    maxTokens: 200000
  },
  {
    label: 'Claude 3 Opus',
    value: 'claude-3-opus',
    provider: 'anthropic',
    maxTokens: 200000
  },
  {
    label: 'Claude Instant',
    value: 'claude-instant',
    provider: 'anthropic',
    maxTokens: 100000
  },
  {
    label: 'GPT-4 Turbo',
    value: 'gpt-4-turbo',
    provider: 'openai',
    maxTokens: 128000
  },
  {
    label: 'GPT-3.5 Turbo',
    value: 'gpt-3.5-turbo',
    provider: 'openai',
    maxTokens: 16385
  }
];

export const TONE_STYLES = [
  { label: 'Professional', value: 'professional' },
  { label: 'Friendly', value: 'friendly' },
  { label: 'Technical', value: 'technical' },
  { label: 'Casual', value: 'casual' },
  { label: 'Academic', value: 'academic' },
  { label: 'Persuasive', value: 'persuasive' }
];

export const TARGET_PLATFORMS = [
  { label: 'ChatGPT', value: 'chatgpt' },
  { label: 'Claude', value: 'claude' },
  { label: 'Perplexity', value: 'perplexity' },
  { label: 'Google Bard', value: 'bard' },
  { label: 'All Platforms', value: 'all' }
];