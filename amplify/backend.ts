import { defineBackend } from '@aws-amplify/backend';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { ocrHandler } from './functions/ocr-handler/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  ocrHandler,
});

const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.usernameAttributes = [];
cfnUserPool.aliasAttributes = undefined;
cfnUserPool.schema = [
  {
    name: 'email',
    attributeDataType: 'String',
    mutable: true,
    required: false,
  },
];
cfnUserPool.autoVerifiedAttributes = [];
cfnUserPool.userAttributeUpdateSettings = undefined;

backend.ocrHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:*::foundation-model/anthropic.*',
      'arn:aws:bedrock:*:*:inference-profile/*',
    ],
  }),
);
