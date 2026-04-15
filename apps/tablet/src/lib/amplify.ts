import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';

type AmplifyOutputs = Parameters<typeof Amplify.configure>[0];

let outputs: AmplifyOutputs | null = null;
let dataClient: ReturnType<typeof generateClient<Schema>> | null = null;

/**
 * `npx ampx sandbox` 実行後にリポジトリルートへ生成される amplify_outputs.json を
 * 動的 import で読み込む。生成前のローカル開発では失敗するため呼び出し側でハンドルする。
 */
export async function configureAmplify(): Promise<boolean> {
  try {
    const mod = await import('../../../../amplify_outputs.json');
    outputs = mod.default as AmplifyOutputs;
    Amplify.configure(outputs);
    dataClient = generateClient<Schema>();
    return true;
  } catch (err) {
    console.warn(
      '[amplify] amplify_outputs.json が見つかりません。`npx ampx sandbox` を実行してください。',
      err,
    );
    return false;
  }
}

export function getDataClient() {
  if (!dataClient) {
    throw new Error('Amplify が未初期化です。configureAmplify() を先に呼んでください。');
  }
  return dataClient;
}

export function getStorageBucketName(): string {
  const bucket = (outputs as { storage?: { bucket_name?: string } } | null)?.storage?.bucket_name;
  if (!bucket) {
    throw new Error('amplify_outputs.json に storage.bucket_name が含まれていません。');
  }
  return bucket;
}
