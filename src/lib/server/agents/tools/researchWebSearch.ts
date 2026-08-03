// src/lib/server/agents/tools/researchWebSearch.ts
// PURPOSE: Controlled live web-search tool for Stage 3 agents.

import type { ToolDefinition } from '$lib/server/agents/types';
import { searchWeb } from '$lib/server/agents/researchGateway';

type Input = {
  query: string;
  maxResults?: number;
  provider?: string;
  purpose?: string;
};

export const researchWebSearchTool: ToolDefinition<Input, Awaited<ReturnType<typeof searchWeb>>> = {
  key: 'research_web_search',
  description: 'Runs a controlled provider-independent web search and returns normalized results for staging only.',
  requiresApproval: false,
  execute: async (input) => {
    return searchWeb(input);
  }
};
