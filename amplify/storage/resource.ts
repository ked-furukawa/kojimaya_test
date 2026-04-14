import { defineStorage } from '@aws-amplify/backend';
import { ocrHandler } from '../functions/ocr-handler/resource';

export const storage = defineStorage({
  name: 'kojimayaPocStorage',
  access: (allow) => ({
    'photos/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
      allow.resource(ocrHandler).to(['read']),
    ],
  }),
});
