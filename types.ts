export enum RequestStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  concurrency: number;
}

export interface QueryItem {
  id: string;
  compound: string;
  status: RequestStatus;
  result: string | null;
  error?: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
}