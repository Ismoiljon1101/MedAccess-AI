// Languages we explicitly surface in the UI. The LLM auto-detects and
// mirrors whichever language the user actually writes in — this list is
// just a hint dropdown for users on the rural/multilingual story.

export interface LanguageOption {
  code: string;          // BCP-47 ish; used as a hint to LLM / Whisper
  label: string;         // Native label
  english: string;       // English label for the chip
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'auto', label: 'Auto-detect', english: 'Auto' },
  { code: 'en', label: 'English', english: 'English' },
  { code: 'es', label: 'Español', english: 'Spanish' },
  { code: 'fr', label: 'Français', english: 'French' },
  { code: 'pt', label: 'Português', english: 'Portuguese' },
  { code: 'ar', label: 'العربية', english: 'Arabic' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', label: 'বাংলা', english: 'Bengali' },
  { code: 'ur', label: 'اردو', english: 'Urdu' },
  { code: 'sw', label: 'Kiswahili', english: 'Swahili' },
  { code: 'am', label: 'አማርኛ', english: 'Amharic' },
  { code: 'ha', label: 'Hausa', english: 'Hausa' },
  { code: 'uz', label: "O'zbekcha", english: 'Uzbek' },
  { code: 'ru', label: 'Русский', english: 'Russian' },
  { code: 'zh', label: '中文', english: 'Chinese' },
  { code: 'id', label: 'Bahasa Indonesia', english: 'Indonesian' },
  { code: 'tr', label: 'Türkçe', english: 'Turkish' },
];

export function resolveLanguageHint(code: string): string | undefined {
  if (!code || code === 'auto') return undefined;
  const found = LANGUAGES.find((l) => l.code === code);
  return found?.english;
}
