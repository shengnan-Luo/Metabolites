import { ApiConfig } from '../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
}

interface OpenAIChatResponse {
  id: string;
  choices?: {
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }[];
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface OpenAIResponsesRequest {
  model: string;
  input: string;
}

interface OpenAIResponsesResponse {
  id: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

const isResponsesEndpoint = (endpoint: string): boolean => /\/v1\/responses\/?$/i.test(endpoint.trim());

const extractResponsesText = (data: OpenAIResponsesResponse): string => {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }

  const segments: string[] = [];
  data.output?.forEach((item) => {
    item.content?.forEach((part) => {
      if ((part.type === 'output_text' || !part.type) && typeof part.text === 'string' && part.text.trim()) {
        segments.push(part.text);
      }
    });
  });

  return segments.join('\n').trim();
};

/**
 * Calls an OpenAI-compatible chat completion endpoint.
 */
export const fetchCompletion = async (
  config: ApiConfig,
  prompt: string
): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const useResponsesApi = isResponsesEndpoint(config.endpoint);
  const payload: OpenAIChatRequest | OpenAIResponsesRequest = useResponsesApi
    ? {
        model: config.model || 'gpt-3.5-turbo',
        input: prompt,
      }
    : {
        model: config.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      };

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as OpenAIChatResponse | OpenAIResponsesResponse;
      throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
    }

    if (useResponsesApi) {
      const text = extractResponsesText(data as OpenAIResponsesResponse);
      if (text) return text;
      throw new Error('No content received in responses output.');
    }

    const chatData = data as OpenAIChatResponse;
    if (chatData.choices && chatData.choices.length > 0) {
      return chatData.choices[0].message.content;
    }

    throw new Error('No content received in response choices.');
  } catch (error: any) {
    console.error('API Request Failed:', error);
    throw new Error(error.message || 'Unknown network error');
  }
};
