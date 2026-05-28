/// <reference types="vite/client" />

declare class SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => any) | null;
  onresult: ((ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((ev: Event) => any) | null;
  onend: ((ev: Event) => any) | null;
}

declare class SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

declare interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

declare interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

declare interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
  speechSynthesis: SpeechSynthesis;
}

declare class SpeechSynthesis {
  pending: boolean;
  paused: boolean;
  speaking: boolean;
  cancel(): void;
  pause(): void;
  resume(): void;
  speak(utterance: SpeechSynthesisUtterance): void;
  getVoices(): SpeechSynthesisVoice[];
}

declare class SpeechSynthesisUtterance extends EventTarget {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  volume: number;
  rate: number;
  pitch: number;
  onstart: ((ev: Event) => any) | null;
  onend: ((ev: Event) => any) | null;
  onerror: ((ev: Event) => any) | null;
}

declare interface SpeechSynthesisVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}
