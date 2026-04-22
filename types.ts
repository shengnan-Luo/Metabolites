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
  minResultLength: number;
}

export interface QueryItem {
  id: string;
  compound: string;
  sheetName: string;
  status: RequestStatus;
  result: string | null;
  isBeneficial: '是' | '否' | null;
  beneficialDirection: string | null;
  benefitModelSummary: string | null;
  benefitConsensus: '一致' | '不一致' | '部分失败' | null;
  error?: string;
}

export interface BatchProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
}
