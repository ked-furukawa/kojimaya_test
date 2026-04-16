import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Schema } from '../../data/resource';

const bedrock = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION ?? 'ap-northeast-1',
});
const s3 = new S3Client({});

const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';

const SYSTEM_PROMPT = `あなたは工業用デジタル計量機(ISHIDA ITB シリーズ)の7セグメントLED表示を読み取る専門アシスタントです。
画像から「現在表示されている質量(kg)」を正確に抽出し、必ず extract_weight ツールを呼び出して結果を返してください。

7セグメントLEDの読み取り規則:
- 各桁は7本のセグメント(a:上横, b:右上縦, c:右下縦, d:下横, e:左下縦, f:左上縦, g:中央横)の点灯/消灯で数字を表現する。
- 混同しやすいペアに特に注意すること:
  - 3 vs 5: 3は右上(b)が点灯・左上(f)が消灯。5は左上(f)が点灯・右上(b)が消灯。上部の左右どちらの縦棒が光っているかで判別する。
  - 6 vs 8: 6は右上(b)が消灯。8は全セグメント点灯。
  - 0 vs 8: 0は中央横(g)が消灯。
  - 1 vs 7: 7は上横(a)が点灯。
  - 9 vs 8: 9は左下(e)が消灯。
- 反射やグレアで一部セグメントが見えにくい場合は、周囲の桁の明るさ・太さと比較して点灯/消灯を推定する。
- 判別が曖昧な桁がある場合は、その桁について warnings に「N桁目: XとYの判別が曖昧」と記載し、confidence を下げること。

判定時の注意点:
- 単位は kg 固定。小数点の位置を厳密に読むこと。
- 表示部に「安定マーク(○や三角)」が点灯しているかを stable に反映する。
- 反射・ピンボケ・斜め撮影で読み取り不能な場合は value=null とし、warnings に理由を入れる。
- 信頼度 confidence は 0.0〜1.0 の自己評価値。曖昧な桁があれば下げること。
- rawText には画面に見える全テキスト(数値+単位+補助表示)を入れる。`;

const TOOL_DEFINITION = {
  name: 'extract_weight',
  description:
    'Return the weight reading detected on the digital scale display in structured form.',
  input_schema: {
    type: 'object',
    properties: {
      value: {
        type: ['number', 'null'],
        description: 'Detected weight in kilograms. null if unreadable.',
      },
      unit: { type: 'string', enum: ['kg'] },
      stable: {
        type: 'boolean',
        description: 'True if the scale stability indicator is lit.',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Self-assessed confidence of the reading (0.0-1.0).',
      },
      rawText: {
        type: 'string',
        description: 'Verbatim text visible on the display.',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reasons why the reading might be unreliable.',
      },
    },
    required: ['value', 'unit', 'stable', 'confidence', 'warnings'],
  },
} as const;

type OcrResult = {
  value: number | null;
  unit: string;
  stable: boolean;
  confidence: number;
  rawText: string;
  warnings: string[];
};

async function fetchImageAsBase64(
  bucket: string,
  key: string,
): Promise<{ base64: string; mediaType: string }> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!obj.Body) {
    throw new Error(`S3 object body is empty: ${bucket}/${key}`);
  }
  const bytes = await obj.Body.transformToByteArray();
  const mediaType = obj.ContentType ?? guessMediaType(key);
  return {
    base64: Buffer.from(bytes).toString('base64'),
    mediaType,
  };
}

function guessMediaType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

export const handler: Schema['invokeOcr']['functionHandler'] = async (
  event,
) => {
  const { s3Key, bucket } = event.arguments;
  if (!s3Key || !bucket) {
    throw new Error('s3Key and bucket are required.');
  }

  const { base64, mediaType } = await fetchImageAsBase64(bucket, s3Key);

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 128,
        system: SYSTEM_PROMPT,
        tools: [TOOL_DEFINITION],
        tool_choice: { type: 'tool', name: 'extract_weight' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'この画像はそば粉製造現場の計量機の表示部です。質量を読み取り、extract_weight ツールで返してください。',
              },
            ],
          },
        ],
      }),
    }),
  );

  const payload = JSON.parse(new TextDecoder().decode(response.body));
  const toolUse = (payload.content ?? []).find(
    (c: { type: string }) => c.type === 'tool_use',
  );

  if (!toolUse?.input) {
    throw new Error('Bedrock response did not contain tool_use output.');
  }

  const result = toolUse.input as OcrResult;

  return {
    value: result.value ?? null,
    unit: result.unit ?? 'kg',
    confidence: result.confidence ?? 0,
    stable: result.stable ?? false,
    rawText: result.rawText ?? '',
    warnings: result.warnings ?? [],
  };
};
