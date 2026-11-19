import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAiProviderConfig, requestCoachReply } from '../lib/ai';

function environment(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...values };
}

describe('getAiProviderConfig', () => {
  it('requires an explicitly configured provider and matching server-side key', () => {
    expect(getAiProviderConfig(environment())).toMatchObject({ ok: false });
    expect(getAiProviderConfig(environment({ AI_PROVIDER: 'openai' }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('OPENAI_API_KEY'),
    });
  });

  it('selects a single configured provider and honors its model override', () => {
    expect(getAiProviderConfig(environment({
      OPENAI_API_KEY: 'test-secret',
      OPENAI_MODEL: 'test-model',
    }))).toEqual({
      ok: true,
      config: { provider: 'openai', apiKey: 'test-secret', model: 'test-model' },
    });
  });
});

describe('requestCoachReply', () => {
  it('sends the prompt to the configured provider and returns its response text', async () => {
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Start with one small step.' } }],
    }), { status: 200 });

    await expect(requestCoachReply({
      provider: 'openai',
      apiKey: 'test-secret',
      model: 'test-model',
    }, 'Help me get started', fetcher)).resolves.toBe('Start with one small step.');
  });

  it('reports provider failures instead of returning a fallback response', async () => {
    const fetcher: typeof fetch = async () => new Response('{}', { status: 401 });

    await expect(requestCoachReply({
      provider: 'openai',
      apiKey: 'test-secret',
      model: 'test-model',
    }, 'Help me get started', fetcher)).rejects.toThrow('The AI provider could not complete the request.');
  });
});
