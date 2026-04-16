import { defineFunction } from '@aws-amplify/backend';

export const ocrHandler = defineFunction({
  name: 'ocr-handler',
  entry: './handler.ts',
  timeoutSeconds: 30,
  memoryMB: 1024,
  environment: {
    BEDROCK_MODEL_ID:
      process.env.BEDROCK_MODEL_ID ?? 'global.anthropic.claude-sonnet-4-6',
    BEDROCK_REGION: process.env.BEDROCK_REGION ?? 'ap-northeast-1',
  },
});
