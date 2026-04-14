import { defineFunction } from '@aws-amplify/backend';

export const ocrHandler = defineFunction({
  name: 'ocr-handler',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024,
  environment: {
    BEDROCK_MODEL_ID:
      process.env.BEDROCK_MODEL_ID ??
      'apac.anthropic.claude-sonnet-4-5-20250929-v1:0',
    BEDROCK_REGION: process.env.BEDROCK_REGION ?? 'ap-northeast-1',
  },
});
