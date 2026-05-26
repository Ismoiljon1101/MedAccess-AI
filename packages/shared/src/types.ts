// Convenience type aliases derived from Zod schemas live in schemas.ts.
// This file is for ambient types that aren't validated at runtime.

export type Provider = 'openrouter';

export interface RagCitation {
  id: string;
  title: string;
  score: number;
}

export interface RagStatus {
  ready: boolean;
  size: number;
  reason?: string;
}

export interface HealthResponse {
  status: 'ok';
  service: 'medaccess-ai';
  version: string;
  providers: {
    openrouter: boolean;
    openaiWhisper: boolean;
  };
  defaultModel: string;
  rag: RagStatus;
  time: string;
}
