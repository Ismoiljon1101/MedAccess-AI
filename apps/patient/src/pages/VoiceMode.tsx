import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mic, MicOff, Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { AiAvatar } from '@/components/AiAvatar';
import type { AvatarState } from '@/components/AiAvatar';
import {
  getVoiceToken, getVoiceStatus,
  streamChatRequest, transcribeAudio,
  type VoiceToken,
} from '@/lib/api';
import { useAppStore } from '@/store/app';

// ── Free OpenRouter voice-capable models ───────────────────────────────
const VOICE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free',  label: 'Llama 3.3 70B (free)' },
  { id: 'google/gemini-2.0-flash-exp:free',         label: 'Gemini 2.0 Flash (free)' },
  { id: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1 (free)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',   label: 'Llama 3.1 8B (fast, free)' },
];

// ── State machine ──────────────────────────────────────────────────────
type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Waveform bars ──────────────────────────────────────────────────────
function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full bg-brand-400 transition-all ${active ? 'waveform-bar' : 'h-1 opacity-30'}`}
          style={active ? { animationDelay: `${i * 0.07}s` } : {}}
        />
      ))}
    </div>
  );
}

// ── Transcript / subtitle bubble ───────────────────────────────────────
function Subtitle({ text, role }: { text: string; role: 'user' | 'assistant' }) {
  if (!text) return null;
  return (
    <div className={`mx-6 mt-4 rounded-2xl px-4 py-3 text-sm text-center ${
      role === 'user'
        ? 'bg-brand-600/20 text-brand-300'
        : 'bg-surface-700 text-slate-200'
    }`}>
      {text}
    </div>
  );
}

// ── Main voice UI (no LiveKit room needed) ─────────────────────────────
function VoiceUI({
  model,
  sessionId,
  language,
  onEnd,
}: {
  model: string;
  sessionId: string | undefined;
  language: string;
  onEnd: () => void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userText, setUserText]     = useState('');
  const [aiText, setAiText]         = useState('');
  const [muted, setMuted]           = useState(false);
  const [liveSessionId, setLiveSessionId] = useState(sessionId);

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef  = useRef<AbortController | null>(null);
  const synthRef  = useRef<SpeechSynthesisUtterance | null>(null);

  // Avatar state mapping
  const avatarState: AvatarState =
    voiceState === 'listening' ? 'listening' :
    voiceState === 'thinking'  ? 'thinking'  : 'idle';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      mediaRef.current?.stop();
    };
  }, []);

  // ── Speak text via Web Speech API (TTS) ───────────────────────────
  function speak(text: string) {
    if (muted || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 1.05;
    utterance.pitch = 1.0;
    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')),
    ) ?? voices.find((v) => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend   = () => setVoiceState('idle');
    utterance.onerror = () => setVoiceState('idle');
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  // ── LLM call → stream response → speak ───────────────────────────
  const askLLM = useCallback(
    async (text: string) => {
      setVoiceState('thinking');
      setAiText('');
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        let assembled = '';
        for await (const event of streamChatRequest(text, liveSessionId, language, ctrl.signal)) {
          if (ctrl.signal.aborted) break;
          if (event.type === 'meta' && event.data.sessionId) {
            setLiveSessionId(event.data.sessionId);
          } else if (event.type === 'token') {
            assembled += event.data.delta ?? '';
            setAiText(assembled);
          } else if (event.type === 'done' || event.type === 'error') {
            break;
          }
        }
        speak(assembled);
      } catch (err: any) {
        if (err.name !== 'AbortError') setVoiceState('idle');
      }
    },
    [liveSessionId, language],
  );

  // ── Toggle recording ─────────────────────────────────────────────
  async function toggleListening() {
    // If AI is speaking, stop and let user talk
    if (voiceState === 'speaking') {
      window.speechSynthesis.cancel();
      setVoiceState('idle');
      return;
    }

    // Stop recording
    if (voiceState === 'listening') {
      mediaRef.current?.stop();
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (voiceState === 'idle') return; // cancelled

        setVoiceState('thinking');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(blob, language);
          if (text) {
            setUserText(text);
            await askLLM(text);
          } else {
            setVoiceState('idle');
          }
        } catch {
          setVoiceState('idle');
        }
      };
      mr.start();
      mediaRef.current = mr;
      setVoiceState('listening');
      setUserText('');
      setAiText('');
    } catch {
      // mic permission denied
    }
  }

  const isListening = voiceState === 'listening';
  const isBusy      = voiceState === 'thinking';

  return (
    <div className="voice-layout">
      {/* ── Header bar ───────────────────────────────────────────── */}
      <div className="voice-header">
        <button type="button" onClick={onEnd} className="voice-close-btn">
          <X size={20} />
        </button>
        <span className="text-sm font-semibold text-white">Voice Mode</span>
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            if (!muted) window.speechSynthesis.cancel();
          }}
          className="voice-mute-btn"
          aria-label={muted ? 'Unmute AI' : 'Mute AI'}
        >
          {muted ? <VolumeX size={18} className="text-slate-500" /> : <Volume2 size={18} className="text-brand-400" />}
        </button>
      </div>

      {/* ── Avatar ───────────────────────────────────────────────── */}
      <div className="voice-avatar-area">
        <AiAvatar state={avatarState} size={120} />

        {/* Status label */}
        <p className={`mt-5 text-sm font-medium ${
          voiceState === 'listening' ? 'text-brand-400' :
          voiceState === 'thinking'  ? 'text-slate-400' :
          voiceState === 'speaking'  ? 'text-ok-400'    : 'text-slate-500'
        }`}>
          {voiceState === 'listening' ? 'Listening…'       :
           voiceState === 'thinking'  ? 'Thinking…'        :
           voiceState === 'speaking'  ? 'Speaking…'        :
           'Tap the mic to speak'}
        </p>

        {/* Waveform */}
        <div className="mt-3">
          <WaveformBars active={isListening || voiceState === 'speaking'} />
        </div>
      </div>

      {/* ── Subtitles ────────────────────────────────────────────── */}
      <div className="voice-subtitles">
        <Subtitle text={userText} role="user" />
        <Subtitle text={aiText}   role="assistant" />
      </div>

      {/* ── Mic button ───────────────────────────────────────────── */}
      <div className="voice-controls">
        <button
          type="button"
          onClick={toggleListening}
          disabled={isBusy}
          aria-label={isListening ? 'Stop' : 'Speak'}
          className={`voice-mic-btn ${isListening ? 'voice-mic-active' : ''}`}
        >
          {isListening ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        <p className="mt-3 text-xs text-slate-600">
          {isListening ? 'Tap to stop' : voiceState === 'speaking' ? 'Tap to interrupt' : 'Tap to speak'}
        </p>
      </div>
    </div>
  );
}

// ── Wrapper: gets LiveKit token & optionally connects to a room ────────
export default function VoiceMode() {
  const { language, upsertSession } = useAppStore();
  const navigate     = useNavigate();
  const [roomToken, setRoomToken]   = useState<VoiceToken | null>(null);
  const [livekitReady, setLivekitReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState(VOICE_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [sessionId]  = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get('s') ?? undefined,
  );

  // Check if LiveKit is configured & get token
  useEffect(() => {
    getVoiceStatus().then(({ configured }) => {
      if (configured) {
        getVoiceToken(sessionId)
          .then((t) => { setRoomToken(t); setLivekitReady(true); })
          .catch(() => setLivekitReady(false));
      }
    });
  }, [sessionId]);

  function handleEnd() {
    navigate(-1);
  }

  const voiceUI = (
    <VoiceUI
      model={selectedModel}
      sessionId={sessionId}
      language={language}
      onEnd={handleEnd}
    />
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-900 relative">
      {/* Model picker (top overlay) */}
      <div className="absolute top-14 right-4 z-20">
        <button
          type="button"
          onClick={() => setShowModelPicker((p) => !p)}
          className="flex items-center gap-1.5 rounded-xl border border-surface-600 bg-surface-800/90 backdrop-blur px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          {VOICE_MODELS.find((m) => m.id === selectedModel)?.label.split(' ').slice(0, 2).join(' ')}
          <ChevronDown size={12} />
        </button>
        {showModelPicker && (
          <div className="absolute right-0 mt-1 w-52 rounded-xl border border-surface-600 bg-surface-800 shadow-xl overflow-hidden z-30">
            {VOICE_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                className={`w-full px-4 py-2.5 text-left text-xs transition hover:bg-surface-700 ${
                  selectedModel === m.id ? 'text-brand-400 bg-brand-600/10' : 'text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* If LiveKit is configured, wrap in a room */}
      {livekitReady && roomToken ? (
        <LiveKitRoom
          token={roomToken.token}
          serverUrl={roomToken.url}
          connect
          audio
          video={false}
          onDisconnected={handleEnd}
          className="flex-1 flex flex-col"
        >
          <RoomAudioRenderer />
          {voiceUI}
        </LiveKitRoom>
      ) : (
        // Standalone mode — no server needed
        voiceUI
      )}
    </div>
  );
}
