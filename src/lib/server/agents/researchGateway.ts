// src/lib/server/agents/researchGateway.ts
// PURPOSE: Provider-independent live research gateway for Stage 3 agents.
// IT: Agents call this wrapper so Relish can swap Tavily/Brave/OpenAI/other research providers later.

export type ResearchProvider = 'tavily' | 'brave' | 'openai' | 'none';

export type WebSearchInput = {
  query: string;
  maxResults?: number;
  provider?: string;
  purpose?: string;
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  score?: number;
  publishedAt?: string;
  raw?: unknown;
};

export type WebSearchOutput = {
  provider: string;
  query: string;
  results: WebSearchResult[];
  note?: string;
};

function normaliseProvider(provider?: string): ResearchProvider {
  const requested = String(provider || process.env.RESEARCH_PROVIDER || '').trim().toLowerCase();
  if (requested === 'tavily' || requested === 'brave' || requested === 'openai') return requested;
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.BRAVE_SEARCH_API_KEY) return 'brave';
  if (process.env.OPENAI_API_KEY && process.env.RESEARCH_PROVIDER === 'openai') return 'openai';
  return 'none';
}

function asPositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// IT: Public entry point used by registered agent tools.
export async function searchWeb(input: WebSearchInput): Promise<WebSearchOutput> {
  const query = clean(input.query);
  if (!query) return { provider: 'none', query, results: [], note: 'Empty search query.' };

  const provider = normaliseProvider(input.provider);
  const maxResults = asPositiveInt(input.maxResults, 5, 10);

  if (provider === 'tavily') return searchTavily(query, maxResults);
  if (provider === 'brave') return searchBrave(query, maxResults);
  if (provider === 'openai') return searchOpenAI(query, maxResults);

  return {
    provider: 'none',
    query,
    results: [],
    note: 'No research provider configured. Set TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, or RESEARCH_PROVIDER=openai with OPENAI_API_KEY.'
  };
}

async function searchTavily(query: string, maxResults: number): Promise<WebSearchOutput> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { provider: 'tavily', query, results: [], note: 'TAVILY_API_KEY is not set.' };

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily search failed: ${res.status} ${res.statusText} ${body}`);
  }

  const body = await res.json();
  const results = Array.isArray(body?.results) ? body.results : [];
  return {
    provider: 'tavily',
    query,
    results: results.map((r: any) => ({
      title: clean(r.title),
      url: clean(r.url),
      snippet: clean(r.content),
      provider: 'tavily',
      score: typeof r.score === 'number' ? r.score : undefined,
      raw: r
    })).filter((r: WebSearchResult) => r.title || r.url || r.snippet)
  };
}

async function searchBrave(query: string, maxResults: number): Promise<WebSearchOutput> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { provider: 'brave', query, results: [], note: 'BRAVE_SEARCH_API_KEY is not set.' };

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brave search failed: ${res.status} ${res.statusText} ${body}`);
  }

  const body = await res.json();
  const results = Array.isArray(body?.web?.results) ? body.web.results : [];
  return {
    provider: 'brave',
    query,
    results: results.map((r: any) => ({
      title: clean(r.title),
      url: clean(r.url),
      snippet: clean(r.description),
      provider: 'brave',
      publishedAt: clean(r.age),
      raw: r
    })).filter((r: WebSearchResult) => r.title || r.url || r.snippet)
  };
}

async function searchOpenAI(query: string, maxResults: number): Promise<WebSearchOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { provider: 'openai', query, results: [], note: 'OPENAI_API_KEY is not set.' };

  // IT: This uses OpenAI Responses with web search as a provider behind the ResearchGateway.
  // IT: The rest of Relish only sees normalized search results and does not depend on OpenAI-specific shapes.
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.RESEARCH_OPENAI_MODEL || 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Search the web for: ${query}\nReturn up to ${maxResults} concise search results as JSON with title, url and snippet.`
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI web search failed: ${res.status} ${res.statusText} ${body}`);
  }

  const body = await res.json();
  const text = clean(body?.output_text ?? body?.output?.map?.((o: any) => o?.content?.map?.((c: any) => c?.text).join(' ')).join(' '));

  // IT: OpenAI web search citations can be provider-specific. For v1, preserve the answer as one source row.
  return {
    provider: 'openai',
    query,
    results: text ? [{ title: `OpenAI web research: ${query}`, url: '', snippet: text.slice(0, 4000), provider: 'openai', raw: body }] : []
  };
}
