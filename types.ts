export interface MailData {
  recipient: string;
  address: string;
  pin_code: string;
  city: string;
  state?: string;
  country: string;
  sorting_center_id: string;
  sorting_center_name: string;
  confidence: number;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  originalImageUrl?: string; // Optional as historical DB data might not have the image
  processedImageUrl?: string;
  data: MailData | null;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
  processingTimeMs?: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SCANNER = 'SCANNER',
  HISTORY = 'HISTORY',
  NETWORK = 'NETWORK'
}

export interface ProcessingOptions {
  grayscale: boolean;
  highContrast: boolean;
  denoise: boolean;
}