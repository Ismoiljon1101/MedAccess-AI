/**
 * VoiceMode — hands-free, continuous voice conversation with MA Agent.
 *
 * Flow:
 *   1. Page opens → automatically starts listening (no button tap required)
 *   2. User speaks → live transcript shown (interimResults)
 *   3. User PAUSES → browser detects silence → auto-submits to LLM
 *   4. LLM streams → TTS reads response aloud
 *   5. TTS finishes → automatically starts listening again (loop)
 *
 * Silence detection: handled natively by the browser.
 *   continuous=false → stops after one utterance (user's natural pause)
 *   interimResults=true → live transcript while speaking
 *   No manual silence timer needed.
 *
 * VAD/interruption: if user starts speaking while AI is talking,
 *   TTS is cancelled and we go back to listening.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Mic, MicOff, Volume2, VolumeX, ChevronDown, Loader2 } from 'lucide-react';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { AiAvatar } from '@/components/AiAvatar';
import type { AvatarState } from '@/components/AiAvatar';
import { getVoiceToken, getVoiceStatus, streamChatRequest, transcribeAudio } from '@/lib/api';
import type { VoiceToken } from '@/lib/api';
import { useAppStore } from '@/store/app';

// ── Free OpenRouter models for voice ──────────────────────────────────────────
const VOICE_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free',        label: 'Gemini 2.0 Flash' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',  label: 'Llama 3.3 70B' },
  { id: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free',   label: 'Llama 3.1 8B (fast)' },
];

/** Map app language code → BCP-47 tag accepted by SpeechRecognition */
function toLangTag(lang: string): string {
  const map: Record<string, string> = {
    auto: '', en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR',
    ar: 'ar-SA', hi: 'hi-IN', bn: 'bn-BD', ur: 'ur-PK', sw: 'sw-KE',
    am: 'am-ET', ha: 'ha-NG', uz: 'uz-UZ', ru: 'ru-RU',
    zh: 'zh-CN', id: 'id-ID', tr: 'tr-TR',
  };
  return map[lang] ?? lang;
}

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Animated waveform ─────────────────────────────────────────────────────────
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

// ── Core voice UI ─────────────────────────────────────────────────────────────
function VoiceUI({
  model: _model,
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

  // Refs so closure callbacks always see current values
  const voiceStateRef = useRef<VoiceState>('idle');
  const mutedRef      = useRef(false);
  const transcriptRef = useRef('');       // captured transcript from current utterance
  const shouldLoopRef = useRef(true);     // keep auto-restarting
  const mediaRef      = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const abortRef      = useRef<AbortController | null>(null);
  const speechRef     = useRef<SpeechRecognition | null>(null);
  const liveSessionRef = useRef(sessionId);

  // Keep refs in sync
  function setVoiceStateSynced(s: VoiceState) {
    voiceStateRef.current = s;
    setVoiceState(s);
  }

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { liveSessionRef.current = liveSession; }, [liveSession]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    shouldLoopRef.current = true;
    // Auto-start after brief delay so the page renders first
    const timer = setTimeout(() => startListening(), 600);
    return () => {
      clearTimeout(timer);
      shouldLoopRef.current = false;
      speechRef.current?.abort();
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
      mediaRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS speak ──────────────────────────────────────────────────────────
  function speak(text: string) {
    if (!text || !window.speechSynthesis) {
      // No TTS → go straight back to listening
      setVoiceStateSynced('idle');
      if (shouldLoopRef.current) setTimeout(() => startListening(), 400);
      return;
    }
    if (mutedRef.current) {
      setVoiceStateSynced('idle');
      if (shouldLoopRef.current) setTimeout(() => startListening(), 400);
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const best = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')),
    ) ?? voices.find((v) => v.lang.startsWith('en'));
    if (best) utt.voice = best;

    utt.onstart = () => setVoiceStateSynced('speaking');
    utt.onend   = () => {
      setVoiceStateSynced('idle');
      // Auto-restart listening after AI finishes speaking
      if (shouldLoopRef.current) setTimeout(() => startListening(), 400);
    };
    utt.onerror = () => {
      setVoiceStateSynced('idle');
      if (shouldLoopRef.current) setTimeout(() => startListening(), 400);
    };
    window.speechSynthesis.speak(utt);
  }

  // ── LLM query ──────────────────────────────────────────────────────────
  const askLLM = useCallback(async (text: string) => {
    setVoiceStateSynced('thinking');
    setAiText('');
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let assembled = '';
      for await (const ev of streamChatRequest(text, liveSessionRef.current, language, ctrl.signal)) {
        if (ctrl.signal.aborted) break;
        if (ev.type === 'meta' && ev.data.sessionId) {
          setLiveSession(ev.data.sessionId);
          liveSessionRef.current = ev.data.sessionId;
        } else if (ev.type === 'token') {
          assembled += ev.data.delta ?? '';
          setAiText(assembled);
        } else if (ev.type === 'done' || ev.type === 'error') break;
      }
      speak(assembled);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setVoiceStateSynced('idle');
        if (shouldLoopRef.current) setTimeout(() => startListening(), 500);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Main listening logic (Web Speech API) ─────────────────────────────
  // Uses continuous=false: browser auto-detects when user pauses and fires
  // the final result + onend event. No manual silence timer needed.
  function startListening() {
    if (!shouldLoopRef.current) return;
    if (voiceStateRef.current !== 'idle') return; // already active

    transcriptRef.current = '';
    setUserText('');

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const sr: SpeechRecognition = new SR();
      sr.lang = toLangTag(language);
      sr.continuous = false;      // stop after user's natural pause → triggers onend
      sr.interimResults = true;   // show live transcript while speaking
      sr.maxAlternatives = 1;
      speechRef.current = sr;

      sr.onstart = () => setVoiceStateSynced('listening');

      sr.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            transcriptRef.current += e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        setUserText(transcriptRef.current || interim);
      };

      (sr as any).onerror = (e: any) => {
        if (e.error === 'no-speech') {
          // Silence timeout — restart silently to keep listening
          setVoiceStateSynced('idle');
          if (shouldLoopRef.current) setTimeout(() => startListening(), 300);
        } else if (e.error !== 'aborted') {
          setVoiceStateSynced('idle');
        }
      };

      sr.onend = () => {
        const transcript = transcriptRef.current.trim();
        if (transcript) {
          // User said something → send to LLM
          askLLM(transcript);
        } else {
          // Nothing captured (e.g. no-speech already handled) → restart
          if (voiceStateRef.current === 'listening') {
            setVoiceStateSynced('idle');
          }
          // Don't restart here — no-speech onerror already schedules it
        }
      };

      sr.start();
      return;
    }

    // ── Fallback: MediaRecorder → backend Whisper ─────────────────────
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceStateSynced('thinking');
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        try {
          const text = await transcribeAudio(blob, language);
          if (text) { setUserText(text); await askLLM(text); }
          else {
            setVoiceStateSynced('idle');
            if (shouldLoopRef.current) setTimeout(() => startListening(), 300);
          }
        } catch {
          setVoiceStateSynced('idle');
          if (shouldLoopRef.current) setTimeout(() => startListening(), 300);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setVoiceStateSynced('listening');
      // Auto-stop MediaRecorder after 8 seconds (no browser VAD for it)
      setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 8000);
    }).catch(() => { /* mic denied */ });
  }

  // ── Manual toggle (tap button to interrupt or stop) ───────────────────
  function handleMicTap() {
    if (voiceState === 'speaking') {
      // Interrupt AI — stop TTS, start listening
      window.speechSynthesis?.cancel();
      setVoiceStateSynced('idle');
      setTimeout(() => startListening(), 200);
      return;
    }
    if (voiceState === 'thinking') {
      // Abort LLM — cancel and restart
      abortRef.current?.abort();
      setVoiceStateSynced('idle');
      setTimeout(() => startListening(), 200);
      return;
    }
    if (voiceState === 'listening') {
      // Manual stop — abort current recognition, stay idle
      shouldLoopRef.current = false;
      speechRef.current?.abort();
      mediaRef.current?.stop();
      setVoiceStateSynced('idle');
      // Re-enable loop after 2s so next tap auto-starts again
      setTimeout(() => { shouldLoopRef.current = true; }, 2000);
      return;
    }
    // Was idle — manually start
    shouldLoopRef.current = true;
    startListening();
  }

  const avatarState: AvatarState =
    voiceState === 'listening' ? 'listening' :
    voiceState === 'thinking'  ? 'thinking'  : 'idle';

  const isBusy      = voiceState === 'thinking';
  const isListening = voiceState === 'listening';
  const isSpeaking  = voiceState === 'speaking';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060c18] overflow-hidden">

      {/* Radial glow */}
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

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-safe-top py-4">
        <button
          type="button"
          onClick={onEnd}
          aria-label="Exit voice mode"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:text-white transition"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-400">MA Agent · Voice</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {isListening ? 'Speak now…' : isSpeaking ? 'Tap mic to interrupt' : isBusy ? 'Processing…' : 'Listening starts automatically'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            if (!muted) window.speechSynthesis?.cancel();
          }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-slate-400 hover:text-white transition"
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} className="text-brand-400" />}
        </button>
      </div>

      {/* ── Avatar + status ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 min-h-0 gap-6">
        <div className="relative">
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

        <div className="text-center space-y-1">
          <p className={`text-base font-semibold tracking-wide transition-colors ${
            isListening ? 'text-brand-400' :
            isBusy      ? 'text-slate-400' :
            isSpeaking  ? 'text-ok-400'    :
                          'text-slate-500'
          }`}>
            {isListening ? 'Listening…'     :
             isBusy      ? 'Thinking…'      :
             isSpeaking  ? 'Speaking…'      :
                           'Ready'}
          </p>
          {isBusy && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600">
              <Loader2 size={12} className="animate-spin" /> Powered by OpenRouter
            </div>
          )}
          {voiceState === 'idle' && !isBusy && (
            <p className="text-[11px] text-slate-600">Listening restarts automatically</p>
          )}
        </div>

        <Waveform active={isListening || isSpeaking} color={isSpeaking ? 'ok' : 'brand'} />
      </div>

      {/* ── Transcript ───────────────────────────────────────────────── */}
      <div className="shrink-0 min-h-[80px] px-6 flex flex-col items-center gap-2 justify-end pb-2">
        {userText && (
          <div className="w-full max-w-sm rounded-2xl bg-brand-600/15 border border-brand-500/20 px-4 py-2.5 text-sm text-brand-300 text-center">
            {userText}
          </div>
        )}
        {aiText && (
          <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-slate-200 text-center leading-relaxed">
            {aiText.length > 140 ? `${aiText.slice(0, 140)}…` : aiText}
          </div>
        )}
      </div>

      {/* ── Mic button ───────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col items-center gap-3 py-8"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={handleMicTap}
          aria-label={
            isListening ? 'Stop (tap to pause)' :
            isSpeaking  ? 'Interrupt AI'        :
            isBusy      ? 'Cancel'              :
                          'Start speaking'
          }
          className={`voice-mic-btn ${isListening ? 'voice-mic-active' : ''}`}
        >
          {isListening ? <MicOff size={30} /> : <Mic size={30} />}
        </button>
        <p className="text-xs text-slate-600">
          {isListening ? 'Pause to send'   :
           isSpeaking  ? 'Tap to interrupt':
           isBusy      ? 'Please wait…'    :
                         'Tap to speak now'}
        </p>
      </div>
    </div>
  );
}

// ── Root: optionally wrap in LiveKitRoom ──────────────────────────────────────
export default function VoiceMode() {
  const { language }   = useAppStore();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('s') ?? undefined;

  const [roomToken, setRoomToken]         = useState<VoiceToken | null>(null);
  const [livekitReady, setLivekitReady]   = useState(false);
  const [selectedModel, setSelectedModel] = useState(VOICE_MODELS[0].id);
  const [showPicker, setShowPicker]       = useState(false);

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
      {/* Model picker */}
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
