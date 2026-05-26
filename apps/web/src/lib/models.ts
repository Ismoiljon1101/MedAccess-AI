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
  // --- Free tier (OpenRouter :free suffix) ---
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B (free)',
    vendor: 'Meta',
    note: 'Free — strong reasoning, no vision',
    vision: false,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash (free)',
    vendor: 'Google',
    note: 'Free — vision-capable',
    vision: true,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    label: 'DeepSeek R1 (free)',
    vendor: 'DeepSeek',
    note: 'Free — strong reasoning',
    vision: false,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    label: 'Qwen 2.5 72B (free)',
    vendor: 'Alibaba',
    note: 'Free — multilingual',
    vision: false,
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    label: 'Mistral 7B (free)',
    vendor: 'Mistral',
    note: 'Free — fast & lightweight',
    vision: false,
  },
  // --- Paid (better quality) ---
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    vendor: 'Anthropic',
    note: 'Paid — best clinical reasoning + vision',
    vision: true,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    vendor: 'OpenAI',
    note: 'Paid — vision-capable',
    vision: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    vendor: 'OpenAI',
    note: 'Paid — cheap & fast',
    vision: true,
  },
];

export const DEFAULT_MODEL_ID = 'meta-llama/llama-3.3-70b-instruct:free';
