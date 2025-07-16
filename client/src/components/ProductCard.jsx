import React, { useState } from 'react';
import { Card, Stack, Thumbnail, Text, Button, Checkbox, Badge, Spinner } from '@shopify/polaris';

export function ProductCard({ 
  product, 
  selected, 
  onSelect, 
  onPreview, 
  onOptimize, 
  onRollback,
  optimizationStatus 
}) {
  const [loading, setLoading] = useState(false);
  const { id, title, image, price, status, currentVersion } = product;

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
        <Stack alignment="center" spacing="loose">
          <Checkbox
            checked={selected}
            onChange={() => onSelect(id)}
          />
          
          <Thumbnail
            source={image?.src || ''}
            alt={title}
            size="medium"
          />
          
          <Stack vertical spacing="extraTight" fill>
            <Text variant="bodyMd" fontWeight="semibold">
              {title}
            </Text>
            <Text variant="bodySm" color="subdued">
              {price}
            </Text>
            <Stack spacing="extraTight">
              {isOptimized && (
                <Badge status="success">
                  {currentVersion}
                </Badge>
              )}
              {status === 'active' && (
                <Badge status="info">Active</Badge>
              )}
            </Stack>
          </Stack>
          
          <Stack spacing="tight">
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