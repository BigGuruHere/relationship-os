// src/lib/server/agents/modelGateway.ts
// PURPOSE: Provider-independent model gateway for agents.
// IT: Agents call this wrapper rather than directly calling OpenAI, Claude, etc.

import { prisma } from '$lib/db';

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'local';

type GenerateStructuredInput = {
  userId: string;
  agentRunId?: string;
  agentStepId?: string;
  provider: string;
  model: string;
  purpose?: string;
  systemPrompt: string;
  userPrompt: string;
  outputSchema?: unknown;
};

type GenerateStructuredResult<T> = {
  text: string;
  structured: T | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

function extractJson(text: string) {
  const clean = (text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(clean.slice(first, last + 1));
    }
    throw new Error('Model did not return valid JSON.');
  }
}

export async function generateStructured<T>(
  input: GenerateStructuredInput
): Promise<GenerateStructuredResult<T>> {
  const startedAt = new Date();

  try {
    let result: GenerateStructuredResult<T>;

    if (input.provider === 'openai') {
      result = await generateWithOpenAI<T>(input);
    } else {
      throw new Error(`Unsupported model provider: ${input.provider}`);
    }

    await prisma.modelInvocation.create({
      data: {
        userId: input.userId,
        agentRunId: input.agentRunId ?? null,
        agentStepId: input.agentStepId ?? null,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose ?? null,
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        requestJsonRedacted: {
          purpose: input.purpose ?? null,
          systemPromptChars: input.systemPrompt.length,
          userPromptChars: input.userPrompt.length,
          outputSchema: input.outputSchema ?? null,
          startedAt: startedAt.toISOString()
        } as any,
        responseJsonRedacted: {
          textPreview: result.text.slice(0, 1200)
        } as any,
        structuredOutputJson: (result.structured ?? {}) as any,
        status: 'success'
      }
    });

    return result;
  } catch (error) {
    await prisma.modelInvocation.create({
      data: {
        userId: input.userId,
        agentRunId: input.agentRunId ?? null,
        agentStepId: input.agentStepId ?? null,
        provider: input.provider,
        model: input.model,
        purpose: input.purpose ?? null,
        requestJsonRedacted: {
          purpose: input.purpose ?? null,
          systemPromptChars: input.systemPrompt.length,
          userPromptChars: input.userPrompt.length,
          outputSchema: input.outputSchema ?? null,
          startedAt: startedAt.toISOString()
        } as any,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}

async function generateWithOpenAI<T>(input: GenerateStructuredInput): Promise<GenerateStructuredResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        {
          role: 'user',
          content: [
            input.userPrompt,
            '',
            'Return strict JSON matching this schema:',
            JSON.stringify(input.outputSchema ?? {}, null, 2)
          ].join('\n')
        }
      ]
    })
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`OpenAI model call failed: ${res.status} ${res.statusText} ${bodyText}`);
  }

  const body = await res.json();
  const text = String(body?.choices?.[0]?.message?.content ?? '').trim();
  const structured = extractJson(text) as T;

  return {
    text,
    structured,
    usage: {
      inputTokens: body?.usage?.prompt_tokens ?? undefined,
      outputTokens: body?.usage?.completion_tokens ?? undefined
    }
  };
}
