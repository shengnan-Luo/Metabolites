import { ApiConfig } from '../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
}

interface OpenAIResponse {
  id: string;
  choices: {
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

/**
 * Calls an OpenAI-compatible chat completion endpoint.
 */
export const fetchCompletion = async (
  config: ApiConfig,
  prompt: string
): Promise<string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  // Some local proxies/providers might strictly require no trailing slash or specific handling
  // but generally standard fetch works.
  
  const payload: OpenAIRequest = {
    model: config.model || 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.3, // Lower temperature for more factual scientific data
  };

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data: OpenAIResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `API Error: ${response.status} ${response.statusText}`);
    }

    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('No content received in response choices.');
    }
  } catch (error: any) {
    console.error('API Request Failed:', error);
    throw new Error(error.message || 'Unknown network error');
  }
};
