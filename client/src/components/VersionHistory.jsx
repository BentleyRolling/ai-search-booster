import React from 'react';
import { Card, ResourceList, ResourceItem, Stack, Badge, Button, Text } from '@shopify/polaris';
import { format } from 'date-fns';

export function VersionHistory({ versions, currentVersion, onRollback, resourceId, resourceType }) {
  const handleRollback = async (version) => {
    await onRollback(resourceType, resourceId, version);
  };

  return (
    <Card title="Version History">
      <ResourceList
        resourceName={{ singular: 'version', plural: 'versions' }}
        items={versions}
        renderItem={(item) => {
          const { version, timestamp, note, author } = item;
          const isCurrent = currentVersion === version;
          
          return (
            <ResourceItem
              id={version}
              onClick={() => {}}
            >
              <Stack alignment="center" distribution="equalSpacing">
                <Stack vertical spacing="extraTight">
                  <Stack alignment="center" spacing="tight">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {version.replace('_', ' ').toUpperCase()}
                    </Text>
                    {isCurrent && <Badge status="success">Current</Badge>}
                  </Stack>
                  
                  <Text variant="bodySm" color="subdued">
                    {timestamp ? format(new Date(timestamp), 'PPpp') : 'No timestamp'}
                  </Text>
                  
                  {note && (
                    <Text variant="bodySm">{note}</Text>
                  )}
                  
                  {author && (
                    <Text variant="bodySm" color="subdued">
                      By {author}
                    </Text>
                  )}
                </Stack>
                
                {!isCurrent && (
                  <Button
                    size="slim"
                    onClick={() => handleRollback(version)}
                  >
                    Rollback
                  </Button>
                )}
              </Stack>
            </ResourceItem>
          );
        }}
      />
    </Card>
  );
}