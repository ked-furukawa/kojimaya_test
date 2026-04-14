import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { ocrHandler } from '../functions/ocr-handler/resource';

const schema = a
  .schema({
    Container: a
      .model({
        name: a.string().required(),
        tareWeightKg: a.float().required(),
        isDefault: a.boolean().required().default(false),
        isActive: a.boolean().required().default(true),
        note: a.string(),
      })
      .authorization((allow) => [allow.authenticated()]),

    Measurement: a
      .model({
        imageS3Key: a.string().required(),
        ocrValueKg: a.float(),
        ocrConfidence: a.float(),
        ocrStable: a.boolean(),
        ocrRawText: a.string(),
        manualValueKg: a.float(),
        containerId: a.id(),
        containerTareSnapshot: a.float(),
        netWeightKg: a.float(),
        targetWeightKg: a.float(),
        judgment: a.enum(['OK', 'OVER', 'UNDER', 'UNJUDGED']),
        ingredientLabel: a.string(),
        operator: a.string(),
        measuredAt: a.datetime().required(),
        note: a.string(),
      })
      .authorization((allow) => [allow.authenticated()]),

    AuditLog: a
      .model({
        entity: a.string().required(),
        entityId: a.id().required(),
        action: a.string().required(),
        before: a.json(),
        after: a.json(),
        actor: a.string().required(),
        at: a.datetime().required(),
      })
      .authorization((allow) => [allow.authenticated()]),

    OcrResult: a.customType({
      value: a.float(),
      unit: a.string(),
      confidence: a.float(),
      stable: a.boolean(),
      rawText: a.string(),
      warnings: a.string().array(),
    }),

    invokeOcr: a
      .mutation()
      .arguments({
        s3Key: a.string().required(),
        bucket: a.string().required(),
      })
      .returns(a.ref('OcrResult'))
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(ocrHandler)),
  })
  .authorization((allow) => [allow.resource(ocrHandler)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
