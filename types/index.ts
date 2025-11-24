export interface Connection {
  name: string;
  profile_link: string;
  employment_status: 'current' | 'past';
}

export interface ToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface LinkedInCredentials {
  email: string;
  password: string;
}

export interface BrightDataConfig {
  apiKey: string;
  zone?: string;
}

export type MessageType =
  | 'LINKEDIN_LOGIN'
  | 'GET_COMPANY_ID'
  | 'GET_CONNECTIONS'
  | 'SCRAPE_HTML'
  | 'EXTRACT_PERSON_ID'
  | 'QUERY_AGENT';

export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
}

export interface ExtensionResponse {
  success: boolean;
  data?: any;
  error?: string;
}
