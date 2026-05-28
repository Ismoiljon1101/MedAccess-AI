import { Loader2, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getTranscribeStatus, transcribe } from '@/lib/api';
import { resolveLanguageHint } from '@/lib/i18n';

interface VoiceButtonProps {
  language: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Tries server-side Whisper first (better quality, multilingual).
// Falls back to the browser's Web Speech API if no OPENAI_API_KEY on the server.
export default function VoiceButton({ language, onTranscript, disabled }: VoiceButtonProps) {
  const [serverWhisper, setServerWhisper] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<any>(null);

  useEffect(() => {
    getTranscribeStatus()
      .then((s) => setServerWhisper(s.available))
      .catch(() => setServerWhisper(false));
  }, []);

  async function startRecording() {
    if (serverWhisper) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        mediaRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setBusy(true);
          try {
            const lang = resolveLanguageHint(language)?.toLowerCase().slice(0, 2);
            const r = await transcribe({ blob, language: lang });
            if (r.text) onTranscript(r.text);
          } catch (err) {
            console.error('Whisper failed, attempting browser fallback', err);
            tryBrowserSpeech();
          } finally {
            setBusy(false);
          }
        };
        mr.start();
        setRecording(true);
      } catch (err) {
        console.error('Microphone error', err);
        tryBrowserSpeech();
      }
    } else {
      tryBrowserSpeech();
    }
  }

  function tryBrowserSpeech() {
    const W = window as any;
    const SpeechRecognition = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('No transcription available. Set OPENAI_API_KEY for server-side Whisper, or use Chrome/Edge.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    const langCode = language && language !== 'auto' ? language : 'en';
    rec.lang = langCode;
    rec.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) onTranscript(text);
    };
    rec.onerror = (e: any) => console.error('SpeechRecognition error', e);
    rec.onend = () => setRecording(false);
    speechRef.current = rec;
    rec.start();
    setRecording(true);
  }

  function stopRecording() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {}
    }
    setRecording(false);
  }

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || busy}
      className={[
        'btn h-10 w-10 rounded-full p-0',
        recording ? 'border-danger-500 bg-danger-500/15 text-danger-500 animate-pulse' : '',
      ].join(' ')}
      aria-label={busy ? 'Transcribing…' : recording ? 'Stop recording' : 'Start voice input'}
      title={
        busy
          ? 'Transcribing...'
          : recording
          ? 'Stop and transcribe'
          : serverWhisper
          ? 'Record (Whisper)'
          : 'Record (browser fallback)'
      }
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : recording ? <MicOff size={16} /> : <Mic size={16} />}
    </button>
  );
}
