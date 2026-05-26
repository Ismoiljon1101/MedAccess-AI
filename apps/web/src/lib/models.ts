// Curated model menu surfaced in the UI. Anything supported by OpenRouter
// works — these are just opinionated defaults for the demo.

export interface ModelOption {
  id: string;          // OpenRouter model id
  label: string;       // Friendly display name
  vendor: string;
  note?: string;
  vision?: boolean;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    vendor: 'Anthropic',
    note: 'Strong clinical reasoning, vision-capable',
    vision: true,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    vendor: 'OpenAI',
    note: 'Balanced quality + vision',
    vision: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    vendor: 'OpenAI',
    note: 'Cheap & fast',
    vision: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash (free)',
    vendor: 'Google',
    note: 'Free tier — vision-capable',
    vision: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    vendor: 'Meta',
    note: 'Open-weight, no vision',
    vision: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat',
    vendor: 'DeepSeek',
    note: 'Very cheap, no vision',
    vision: false,
  },
];

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4.5';
