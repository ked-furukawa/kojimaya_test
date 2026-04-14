import { Amplify } from 'aws-amplify';

/**
 * amplify_outputs.json は `npx ampx sandbox` 実行後にリポジトリルートへ生成される。
 * デプロイ前のローカル開発では存在しない可能性があるため、動的 import + フォールバック
 * で安全に扱う。
 */
export async function configureAmplify(): Promise<boolean> {
  try {
    const outputs = (await import('../../../../amplify_outputs.json')).default;
    Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);
    return true;
  } catch {
    console.warn(
      '[amplify] amplify_outputs.json が見つかりません。`npx ampx sandbox` を実行してください。',
    );
    return false;
  }
}
