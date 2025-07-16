import React, { useState, useEffect } from 'react';
import { Card, Select, TextField, Stack, Button } from '@shopify/polaris';

export function SettingsPanel({ onSettingsChange }) {
  const [settings, setSettings] = useState({
    aiModel: 'claude-3-sonnet',
    toneStyle: 'professional',
    keywords: '',
    targetAudience: 'general'
  });

  useEffect(() => {
    const saved = localStorage.getItem('ai-search-settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleChange = (field) => (value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    localStorage.setItem('ai-search-settings', JSON.stringify(newSettings));
    onSettingsChange?.(newSettings);
  };

  const aiModelOptions = [
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
  ];

  const toneOptions = [
    { label: 'Professional', value: 'professional' },
    { label: 'Friendly', value: 'friendly' },
    { label: 'Technical', value: 'technical' },
    { label: 'Casual', value: 'casual' },
    { label: 'Academic', value: 'academic' }
  ];

  return (
    <Card title="AI Optimization Settings">
      <Card.Section>
        <Stack vertical spacing="loose">
          <Select
            label="AI Model"
            options={aiModelOptions}
            value={settings.aiModel}
            onChange={handleChange('aiModel')}
          />
          
          <Select
            label="Tone Style"
            options={toneOptions}
            value={settings.toneStyle}
            onChange={handleChange('toneStyle')}
          />
          
          <TextField
            label="Target Keywords"
            value={settings.keywords}
            onChange={handleChange('keywords')}
            placeholder="organic, sustainable, eco-friendly"
            helpText="Comma-separated keywords to emphasize"
          />
          
          <TextField
            label="Target Audience"
            value={settings.targetAudience}
            onChange={handleChange('targetAudience')}
            placeholder="e.g., health-conscious consumers"
          />
        </Stack>
      </Card.Section>
    </Card>
  );
}