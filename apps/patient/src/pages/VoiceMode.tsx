import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Mic, MicOff, Volume2, VolumeX, ChevronDown, Loader2 } from 'lucide-react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { AiAvatar } from '@/components/AiAvatar';
import type { AvatarState } from '@/components/AiAvatar';
import { getVoiceToken, getVoiceStatus, streamChatRequest, transcribeAudio } from '@/lib/api';
import type { VoiceToken } from '@/lib/api';
import { useAppStore } from '@/store/app';

// ── Free OpenRouter models for voice ──────────────────────────────────
const VOICE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
  { id: 'google/gemini-2.0-flash-exp:free',        label: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-r1:free',              label: 'DeepSeek R1' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',  label: 'Llama 3.1 8B (fast)' },
];

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Animated waveform ─────────────────────────────────────────────────
function Waveform({ active, color = 'brand' }: { active: boolean; color?: string }) {
  const bars = 11;
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-150 ${
            active ? `bg-${color}-400` : 'bg-slate-700'
          }`}
          style={
            active
              ? {
                  height: `${8 + Math.sin(i * 0.8) * 8}px`,
                  animation: `waveform ${0.6 + (i % 3) * 0.15}s ease-in-out ${i * 0.06}s infinite alternate`,
                }
              : { height: '3px' }
          }
        />
      ))}
    </div>
  );
}

// ── Core voice UI ─────────────────────────────────────────────────────
function VoiceUI({
  model,
  sessionId,
  language,
  onEnd,
}: {
  model: string;
  sessionId?: string;
  language: string;
  onEnd: () => void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userText, setUserText]     = useState('');
  const [aiText, setAiText]         = useState('');
  const [muted, setMuted]           = useState(false);
  const [liveSession, setLiveSession] = useState(sessionId);

  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef  = useRef<AbortController | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
      speechRef.current?.stop();
      mediaRef.current?.stop();
    };
  }, []);

  const avatarState: AvatarState =
    voiceState === 'listening' ? 'listening' :
    voiceState === 'thinking'  ? 'thinking'  : 'idle';

  function speak(text: string) {
    if (muted || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const best = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')),
    ) ?? voices.find((v) => v.lang.startsWith('en'));
    if (best) utt.voice = best;
    utt.onstart = () => setVoiceState('speaking');
    utt.onend   = () => setVoiceState('idle');
    utt.onerror = () => setVoiceState('idle');
    window.speechSynthesis.speak(utt);
  }

  const askLLM = useCallback(async (text: string) => {
    setVoiceState('thinking');
    setAiText('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let assembled = '';
      for await (const ev of streamChatRequest(text, liveSession, language, ctrl.signal)) {
        if (ctrl.signal.aborted) break;
        if (ev.type === 'meta' && ev.data.sessionId) setLiveSession(ev.data.sessionId);
        else if (ev.type === 'token') { assembled += ev.data.delta ?? ''; setAiText(assembled); }
        else if (ev.type === 'done' || ev.type === 'error') break;
      }
      speak(assembled);
    } catch (e: any) {
      if (e.name !== 'AbortError') setVoiceState('idle');
    }
  }, [liveSession, language]);

  async function toggleListen() {
    if (voiceState === 'speaking') { window.speechSynthesis?.cancel(); setVoiceState('idle'); return; }
    if (voiceState === 'listening') {
      speechRef.current?.stop();
      mediaRef.current?.stop();
      return;
    }

    setUserText('');
    setAiText('');

    // Web Speech API (no server key needed)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const sr: SpeechRecognition = new SR();
      sr.lang = language || 'en-US';
      sr.interimResults = false;
      sr.maxAlternatives = 1;
      speechRef.current = sr;
      setVoiceState('listening');
      sr.onresult = async (e: SpeechRecognitionEvent) => {
        const text = e.results[0]?.[0]?.transcript?.trim();
        if (text) { setUserText(text); await askLLM(text); }
        else setVoiceState('idle');
      };
      sr.onerror = () => setVoiceState('idle');
      sr.onend   = () => { if (voiceState === 'listening') setVoiceState('idle'); };
      sr.start();
      return;
    }

    // Fallback: MediaRecorder → backend Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceState('thinking');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(blob, language);
          if (text) { setUserText(text); await askLLM(text); }
          else setVoiceState('idle');
        } catch { setVoiceState('idle'); }
      };
      mr.start();
      mediaRef.current = mr;
      setVoiceState('listening');
    } catch { /* mic denied */ }
  }

  const isBusy     = voiceState === 'thinking';
  const isListening = voiceState === 'listening';
  const isSpeaking  = voiceState === 'speaking';

  return (
    /* Full-screen overlay — sits above everything */
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060c18] overflow-hidden">

      {/* Radial glow behind avatar */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isListening
            ? 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(59,130,246,0.18) 0%, transparent 70%)'
            : isSpeaking
            ? 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(34,197,94,0.12) 0%, transparent 70%)'
            : isBusy
            ? 'radial-gradient(ellipse 50% 40% at 50% 45%, rgba(59,130,246,0.10) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 45% 35% at 50% 45%, rgba(59,130,246,0.06) 0%, transparent 70%)',
          transition: 'background 0.6s ease',
        }}
      />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-safe-top py-4">
        <button
          type="button"
          onClick={onEnd}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:text-white transition"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">MA Agent · Voice</p>
        </div>

        <button
          type="button"
          onClick={() => { setMuted((m) => !m); if (!muted) window.speechSynthesis?.cancel(); }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:text-white transition"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} className="text-brand-400" />}
        </button>
      </div>

      {/* ── Avatar + status ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 min-h-0 gap-6">

        {/* Avatar with extra outer glow ring */}
        <div className="relative">
          {/* Outer ambient glow */}
          <div
            className="absolute -inset-8 rounded-full pointer-events-none"
            style={{
              background: isListening
                ? 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)'
                : isSpeaking
                ? 'radial-gradient(circle, rgba(34,197,94,0.20) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)',
              transition: 'background 0.5s ease',
            }}
          />
          <AiAvatar state={avatarState} size={140} />
        </div>

        {/* Status */}
        <div className="text-center space-y-1">
          <p className={`text-base font-semibold tracking-wide transition-colors ${
            isListening ? 'text-brand-400' :
            isBusy      ? 'text-slate-400' :
            isSpeaking  ? 'text-ok-400'    :
                          'text-slate-500'
          }`}>
            {isListening ? 'Listening…'        :
             isBusy      ? 'Thinking…'         :
             isSpeaking  ? 'Speaking…'         :
                           'Tap to speak'}
          </p>
          {isBusy && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
              <Loader2 size={12} className="animate-spin" /> Powered by OpenRouter
            </div>
          )}
        </div>

        {/* Waveform visualizer */}
        <Waveform active={isListening || isSpeaking} color={isSpeaking ? 'ok' : 'brand'} />

      </div>

      {/* ── Transcript area ──────────────────────────────────────── */}
      <div className="shrink-0 min-h-[80px] px-6 flex flex-col items-center gap-2 justify-end pb-2">
        {userText && (
          <div className="w-full max-w-sm rounded-2xl bg-brand-600/15 border border-brand-500/20 px-4 py-2.5 text-sm text-brand-300 text-center">
            {userText}
          </div>
        )}
        {aiText && (
          <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-slate-200 text-center leading-relaxed">
            {aiText.length > 120 ? `${aiText.slice(0, 120)}…` : aiText}
          </div>
        )}
      </div>

      {/* ── Mic button ───────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col items-center gap-3 py-8"
           style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}>

        <button
          type="button"
          onClick={toggleListen}
          disabled={isBusy}
          aria-label={isListening ? 'Stop speaking' : 'Speak'}
          className={`voice-mic-btn ${isListening ? 'voice-mic-active' : ''}`}
        >
          {isListening ? <MicOff size={30} /> : <Mic size={30} />}
        </button>

        <p className="text-xs text-slate-600">
          {isListening ? 'Tap to stop' : isSpeaking ? 'Tap to interrupt' : isBusy ? 'Please wait…' : 'Tap to speak'}
        </p>
      </div>

    </div>
  );
}

// ── Root: fetch token → optionally wrap in LiveKitRoom ────────────────
export default function VoiceMode() {
  const { language }     = useAppStore();
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();
  const sessionId        = searchParams.get('s') ?? undefined;

  const [roomToken, setRoomToken]       = useState<VoiceToken | null>(null);
  const [livekitReady, setLivekitReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState(VOICE_MODELS[0].id);
  const [showPicker, setShowPicker]     = useState(false);

  useEffect(() => {
    getVoiceStatus().then(({ configured }) => {
      if (!configured) return;
      getVoiceToken(sessionId)
        .then((t) => { setRoomToken(t); setLivekitReady(true); })
        .catch(() => { /* standalone fallback */ });
    });
  }, [sessionId]);

  const voiceUI = (
    <VoiceUI
      model={selectedModel}
      sessionId={sessionId}
      language={language}
      onEnd={() => navigate(-1)}
    />
  );

  return (
    <>
      {/* Model picker floating pill — above the overlay */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60]">
        <button
          type="button"
          onClick={() => setShowPicker((p) => !p)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 backdrop-blur px-4 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition"
        >
          {VOICE_MODELS.find((m) => m.id === selectedModel)?.label}
          <ChevronDown size={11} />
        </button>
        {showPicker && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 rounded-2xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
            {VOICE_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedModel(m.id); setShowPicker(false); }}
                className={`w-full px-4 py-3 text-left text-xs transition hover:bg-white/5 ${
                  selectedModel === m.id ? 'text-brand-400' : 'text-slate-300'
                }`}
              >
                {m.label}
                {selectedModel === m.id && <span className="float-right text-brand-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice UI — LiveKit room if configured, standalone otherwise */}
      {livekitReady && roomToken ? (
        <LiveKitRoom
          token={roomToken.token}
          serverUrl={roomToken.url}
          connect
          audio
          video={false}
          onDisconnected={() => navigate(-1)}
        >
          <RoomAudioRenderer />
          {voiceUI}
        </LiveKitRoom>
      ) : (
        voiceUI
      )}
    </>
  );
}
