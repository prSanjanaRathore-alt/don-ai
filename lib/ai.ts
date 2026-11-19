import 'server-only';

export type AiProvider = 'openai' | 'anthropic' | 'gemini';

export interface AiProviderConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

type ProviderConfigResult =
  | { ok: true; config: AiProviderConfig }
  | { ok: false; error: string };

const providerSettings: Record<AiProvider, { keyName: string; defaultModel: string }> = {
  openai: { keyName: 'OPENAI_API_KEY', defaultModel: 'gpt-4o-mini' },
  anthropic: { keyName: 'ANTHROPIC_API_KEY', defaultModel: 'claude-3-7-sonnet-latest' },
  gemini: { keyName: 'GEMINI_API_KEY', defaultModel: 'gemini-2.5-flash' },
};

export function getAiProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfigResult {
  const configuredProvider = env.AI_PROVIDER?.trim().toLowerCase();
  const availableProviders = (Object.keys(providerSettings) as AiProvider[])
    .filter((provider) => Boolean(env[providerSettings[provider].keyName]));
  const provider = configuredProvider || (availableProviders.length === 1 ? availableProviders[0] : '');

  if (!provider || !Object.hasOwn(providerSettings, provider)) {
    return {
      ok: false,
      error: 'Set AI_PROVIDER and one matching server-side provider key to enable the coach.',
    };
  }

  const typedProvider = provider as AiProvider;
  const setting = providerSettings[typedProvider];
  const apiKey = env[setting.keyName];
  if (!apiKey) {
    return {
      ok: false,
      error: `Add ${setting.keyName} as a server-side environment variable to enable the coach.`,
    };
  }

  const modelName = `${typedProvider.toUpperCase()}_MODEL`;
  return {
    ok: true,
    config: {
      provider: typedProvider,
      apiKey,
      model: env[modelName]?.trim() || setting.defaultModel,
    },
  };
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function getProviderResponse(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  fetcher: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new AiProviderError('The AI provider could not complete the request. Check the provider key and model settings.');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    if (controller.signal.aborted) {
      throw new AiProviderError('The AI provider took too long to respond. Please try again.');
    }
    throw new AiProviderError('The AI provider is unavailable right now. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

function readText(value: unknown, path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

export async function requestCoachReply(
  config: AiProviderConfig,
  prompt: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  let response: unknown;

  if (config.provider === 'openai') {
    response = await getProviderResponse(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        messages: [
          { role: 'system', content: 'You are DON AI, a thoughtful and practical personal coach. Give a clear next step, match the user’s language, stay encouraging without pressure, and never claim an action was completed.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.6,
      },
      fetcher,
    );
    const text = readText(response, ['choices', '0', 'message', 'content']);
    if (text) return text;
  } else if (config.provider === 'anthropic') {
    response = await getProviderResponse(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01' },
      {
        model: config.model,
        max_tokens: 600,
        system: 'You are DON AI, a thoughtful and practical personal coach. Give a clear next step, match the user’s language, stay encouraging without pressure, and never claim an action was completed.',
        messages: [{ role: 'user', content: prompt }],
      },
      fetcher,
    );
    const text = readText(response, ['content', '0', 'text']);
    if (text) return text;
  } else {
    response = await getProviderResponse(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      { 'x-goog-api-key': config.apiKey },
      {
        systemInstruction: {
          parts: [{ text: 'You are DON AI, a thoughtful and practical personal coach. Give a clear next step, match the user’s language, stay encouraging without pressure, and never claim an action was completed.' }],
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
      },
      fetcher,
    );
    const text = readText(response, ['candidates', '0', 'content', 'parts', '0', 'text']);
    if (text) return text;
  }

  throw new AiProviderError('The AI provider returned an empty response. Please try again.');
}
