import axios from 'axios';
import { WebSearchContext, WebSearchResult } from '@/types';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

export const searchWebForTopic = async (topic: string): Promise<WebSearchContext | null> => {
  if (!TAVILY_API_KEY) {
    console.warn('TAVILY_API_KEY not set — skipping web search');
    return null;
  }

  const query = `${topic} market trends problems challenges`;

  try {
    const response = await axios.post(TAVILY_API_URL, {
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
      include_images: true,
      max_results: 2,
    }, { timeout: 10000 });

    const data = response.data;

    const results: WebSearchResult[] = (data.results || [])
      .slice(0, 2)
      .map((r: any) => ({
        title: r.title || '',
        snippet: (r.content || '').slice(0, 300),
        url: r.url || '',
      }));

    const images: string[] = (data.images || [])
      .slice(0, 2)
      .filter((img: any) => typeof img === 'string' && img.startsWith('http'));

    return {
      query,
      summary: data.answer || '',
      results,
      images,
    };
  } catch (error: any) {
    console.error('Web search failed (non-fatal):', error.message);
    return null;
  }
};
