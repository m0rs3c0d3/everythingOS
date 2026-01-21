// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Web Search Tool
// Search the web for information
// ═══════════════════════════════════════════════════════════════════════════════

import { Tool, ToolResult } from '../ToolTypes';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchConfig {
  provider: 'serper' | 'serpapi' | 'tavily' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  maxResults?: number;
}

let searchConfig: WebSearchConfig = {
  provider: 'serper',
  maxResults: 5,
};

export function configureWebSearch(config: Partial<WebSearchConfig>): void {
  searchConfig = { ...searchConfig, ...config };
}

async function performSearch(query: string): Promise<WebSearchResult[]> {
  // This is a skeleton - implement based on provider
  
  switch (searchConfig.provider) {
    case 'serper': {
      if (!searchConfig.apiKey) {
        throw new Error('Serper API key not configured');
      }
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': searchConfig.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: searchConfig.maxResults }),
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return (data.organic || []).map((r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      }));
    }
    
    case 'tavily': {
      if (!searchConfig.apiKey) {
        throw new Error('Tavily API key not configured');
      }
      
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: searchConfig.apiKey,
          query,
          max_results: searchConfig.maxResults,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      return (data.results || []).map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));
    }
    
    case 'custom': {
      if (!searchConfig.baseUrl) {
        throw new Error('Custom search base URL not configured');
      }
      
      const response = await fetch(`${searchConfig.baseUrl}?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      return response.json();
    }
    
    default:
      throw new Error(`Unknown search provider: ${searchConfig.provider}`);
  }
}

export const webSearchTool: Tool = {
  name: 'web_search',
  version: '1.0.0',
  description: 'Search the web for current information. Use for questions about recent events, facts you\'re unsure about, or anything that might have changed since your knowledge cutoff.',
  category: 'search',
  trustLevel: 'moderate',  // Has network access, but read-only
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
        minLength: 1,
        maxLength: 500,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results (default: 5)',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
          },
        },
      },
      query: { type: 'string' },
    },
  },
  
  examples: [
    {
      description: 'Search for current events',
      input: { query: 'latest news today' },
      output: { results: [{ title: '...', url: '...', snippet: '...' }] },
    },
  ],
  
  tags: ['search', 'web', 'information'],
  
  handler: async (input, context): Promise<ToolResult> => {
    const { query, maxResults } = input as { query: string; maxResults?: number };
    
    if (maxResults) {
      searchConfig.maxResults = maxResults;
    }
    
    try {
      context.log('info', `Searching: ${query}`);
      
      const results = await performSearch(query);
      
      context.log('info', `Found ${results.length} results`);
      
      return {
        success: true,
        data: {
          results,
          query,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  },
};
