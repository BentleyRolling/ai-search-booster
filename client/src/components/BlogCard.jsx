import React, { useState } from 'react';
import { Card, Stack, Text, Button, Checkbox, Badge, Spinner } from '@shopify/polaris';
import { format } from 'date-fns';

export function BlogCard({ 
  blog, 
  selected, 
  onSelect, 
  onPreview, 
  onOptimize, 
  onRollback,
  optimizationStatus 
}) {
  const [loading, setLoading] = useState(false);
  const { id, title, author, published_at, summary, currentVersion } = blog;

  const handleAction = async (action) => {
    setLoading(true);
    try {
      await action(id);
    } finally {
      setLoading(false);
    }
  };

  const isOptimized = currentVersion && currentVersion !== 'original';

  return (
    <Card>
      <Card.Section>
        <Stack vertical spacing="loose">
          <Stack alignment="center" distribution="equalSpacing">
            <Stack alignment="center" spacing="loose">
              <Checkbox
                checked={selected}
                onChange={() => onSelect(id)}
              />
              
              <Stack vertical spacing="extraTight">
                <Text variant="bodyMd" fontWeight="semibold">
                  {title}
                </Text>
                <Stack spacing="tight">
                  <Text variant="bodySm" color="subdued">
                    By {author}
                  </Text>
                  <Text variant="bodySm" color="subdued">
                    {format(new Date(published_at), 'PP')}
                  </Text>
                </Stack>
              </Stack>
            </Stack>
            
            <Stack spacing="extraTight">
              {isOptimized && (
                <Badge status="success">
                  {currentVersion}
                </Badge>
              )}
            </Stack>
          </Stack>
          
          {summary && (
            <Text variant="bodySm" truncate>
              {summary}
            </Text>
          )}
          
          <Stack distribution="trailing" spacing="tight">
            {loading ? (
              <Spinner size="small" />
            ) : (
              <>
                <Button
                  size="slim"
                  onClick={() => handleAction(onPreview)}
                >
                  Preview
                </Button>
                
                {!isOptimized ? (
                  <Button
                    size="slim"
                    primary
                    onClick={() => handleAction(onOptimize)}
                  >
                    Optimize
                  </Button>
                ) : (
                  <Button
                    size="slim"
                    destructive
                    onClick={() => handleAction(onRollback)}
                  >
                    Rollback
                  </Button>
                )}
              </>
            )}
          </Stack>
        </Stack>
      </Card.Section>
    </Card>
  );
}