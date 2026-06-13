/**
 * VoiceMode — push-to-talk voice conversation with MA Agent.
 *
 * Flow (hold-to-speak, release-to-send — prevents interruptions):
 *   1. Hold the mic button → records (MediaRecorder) + live transcript (Web Speech)
 *   2. Release → audio goes to Whisper STT (server); browser transcript is the fallback
 *   3. Transcript → chat LLM (streamed) → spoken aloud via browser TTS
 *   4. Back to idle — hold again to talk. No auto-loop, no barge-in races.
 *
 * LiveKit realtime was intentionally removed: push-to-talk is far more reliable
 * to demo and needs no realtime media server.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { X, Mic, Volume2, VolumeX, ChevronDown, Loader2 } from 'lucide-react';
import { AiAvatar } from '@/components/AiAvatar';
import type { AvatarState } from '@/components/AiAvatar';
import { streamChatRequest, transcribeAudio, bookAppointment } from '@/lib/api';
import { parseBookingMarker, type BookingMarker } from '@/lib/booking';
import { useAppStore } from '@/store/app';

// id '' = server's configured default (OPENROUTER_CHAT_MODEL).
const VOICE_MODELS = [
  { id: '',                               label: 'MA Agent · default'  },
  { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3'         },
  { id: 'qwen/qwen-2.5-7b-instruct',      label: 'Qwen 2.5 · fast'     },
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

type VoiceState = 'idle' | 'recording' | 'thinking' | 'speaking';

// ── Animated waveform ─────────────────────────────────────────────────────────
function Waveform({ active, color = 'brand' }: { active: boolean; color?: string }) {
  const bars = 11;
  // Static classes so Tailwind's JIT keeps them — `bg-${color}-400` would be purged.
  const activeClass = color === 'ok' ? 'bg-ok-400' : 'bg-brand-400';
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-150 ${active ? activeClass : 'bg-ink-700'}`}
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
  model,
  sessionId,
  language,
  onEnd,
}: {
  model: string;
  sessionId?: string;
  language: string;
  onEnd: (sessionId?: string) => void;
}) {
  const { patientProfile, addAppointment } = useAppStore();
  const patientPhone = patientProfile?.phone;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userText, setUserText]     = useState('');
  const [aiText, setAiText]         = useState('');
  const [muted, setMuted]           = useState(false);
  const [liveSession, setLiveSession] = useState(sessionId);
  const [errMsg, setErrMsg]         = useState<string | null>(null);
  const [bookedMsg, setBookedMsg]   = useState<string | null>(null);

  // Turn an agreed <<BOOK>> marker into a real appointment (silent, like Chat).
  const autoBook = useCallback(async (b: BookingMarker) => {
    if (!b.date || !b.time || !patientPhone) return;
    try {
      const result = await bookAppointment({
        patientPhone,
        doctorId:      b.doctorId,
        facilityId:    b.facilityId,
        specialty:     b.specialty || 'General Practice',
        urgency:       'see-clinician-soon',
        scheduledDate: b.date,
        scheduledTime: b.time,
        agentSummary:  `MA Agent voice booking · ${b.specialty || ''}${b.reason ? ` — ${b.reason}` : ''}`,
        sessionId:     liveSessionRef.current,
      });
      addAppointment({
        appointmentId:    result.appointmentId,
        facilityId:       b.facilityId,
        facilityName:     b.facilityName ?? '',
        doctorId:         b.doctorId,
        doctorName:       b.doctorName ?? '',
        specialty:        b.specialty || 'General Practice',
        date:             result.scheduledDate,
        startTime:        result.scheduledTime,
        endTime:          result.scheduledEndTime,
        scheduledDate:    result.scheduledDate,
        scheduledTime:    result.scheduledTime,
        scheduledEndTime: result.scheduledEndTime,
        status:           'pending',
        bookedAt:         Date.now(),
      });
      setBookedMsg(`Appointment booked · ${result.scheduledDate} at ${result.scheduledTime}`);
    } catch {
      /* slot taken / offline — non-fatal in voice; patient can rebook in Find Care */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientPhone]);

  // Refs so closure callbacks always see current values
  const voiceStateRef = useRef<VoiceState>('idle');
  const mutedRef       = useRef(false);
  const srTranscriptRef = useRef('');           // browser transcript (live + fallback)
  const mediaRef       = useRef<MediaRecorder | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const abortRef       = useRef<AbortController | null>(null);
  const srRef          = useRef<SpeechRecognition | null>(null);
  const liveSessionRef = useRef(sessionId);
  const modelRef       = useRef(model);

  function setVoiceStateSynced(s: VoiceState) {
    voiceStateRef.current = s;
    setVoiceState(s);
  }

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { liveSessionRef.current = liveSession; }, [liveSession]);
  useEffect(() => { modelRef.current = model; }, [model]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      srRef.current?.abort();
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
      mediaRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── TTS speak ──────────────────────────────────────────────────────────
  function speak(text: string) {
    if (!text || !window.speechSynthesis || mutedRef.current) {
      setVoiceStateSynced('idle');
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const best =
      voices.find((v) => v.lang.startsWith('en') && /Google|Natural|Premium/.test(v.name)) ??
      voices.find((v) => v.lang.startsWith('en'));
    if (best) utt.voice = best;
    utt.onstart = () => setVoiceStateSynced('speaking');
    utt.onend   = () => setVoiceStateSynced('idle');
    utt.onerror = () => setVoiceStateSynced('idle');
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
      let streamError: string | null = null;
      for await (const ev of streamChatRequest(text, liveSessionRef.current, language, { signal: ctrl.signal, model: modelRef.current || undefined })) {
        if (ctrl.signal.aborted) break;
        if (ev.type === 'meta' && ev.data.sessionId) {
          setLiveSession(ev.data.sessionId);
          liveSessionRef.current = ev.data.sessionId;
        } else if (ev.type === 'token') {
          assembled += ev.data.delta ?? '';
          // Never show the raw <<BOOK>> marker in the transcript.
          setAiText(parseBookingMarker(assembled).cleanText);
        } else if (ev.type === 'error') {
          streamError = ev.data?.message ?? 'error';
          break;
        } else if (ev.type === 'done') break;
      }
      const { cleanText, booking } = parseBookingMarker(assembled);
      if (streamError || !cleanText.trim()) {
        const msg = "Sorry — I can't reach the AI service right now. Please try again in a moment.";
        setAiText(msg);
        speak(msg);
      } else {
        setAiText(cleanText);
        // Speak only the spoken sentence, never the marker.
        speak(cleanText);
        // Agent agreed a real slot → book it silently in the background.
        if (booking?.date && booking?.time) autoBook(booking);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        const msg = "Sorry — I couldn't connect. Please check your connection and try again.";
        setAiText(msg);
        speak(msg);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Push-to-talk: start recording on press ────────────────────────────
  async function startRecording() {
    if (voiceStateRef.current === 'thinking')  return;    // busy — ignore
    if (voiceStateRef.current === 'recording') return;    // already recording
    window.speechSynthesis?.cancel();                     // interrupt any TTS
    setErrMsg(null);
    setUserText('');
    setAiText('');
    srTranscriptRef.current = '';
    // Set state before the async getUserMedia so a fast release is seen by
    // stopAndSend (otherwise it returns early and the UI sticks on "recording").
    setVoiceStateSynced('recording');

    // Browser STT — live transcript while holding + fallback if Whisper is down
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const sr: SpeechRecognition = new SR();
      sr.lang = toLangTag(language);
      sr.continuous = true;
      sr.interimResults = true;
      sr.maxAlternatives = 1;
      sr.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) srTranscriptRef.current += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setUserText(srTranscriptRef.current || interim);
      };
      (sr as any).onerror = () => { /* non-fatal — Whisper still runs */ };
      srRef.current = sr;
      try { sr.start(); } catch { /* already started */ }
    }

    // Audio capture for Whisper (primary, most accurate)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Released while we were awaiting? Abort cleanly — don't leave an orphan recorder.
      // Cast: the ref mutates via setVoiceStateSynced, which TS can't see across the await.
      if ((voiceStateRef.current as string) !== 'recording') {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      mediaRef.current = mr;
    } catch {
      // No mic AND no browser STT → nothing to record; revert so the UI isn't stuck.
      if (!SR) {
        setErrMsg('Microphone unavailable. Please allow mic access.');
        setVoiceStateSynced('idle');
      }
    }
  }

  // ── Push-to-talk: stop + send on release ──────────────────────────────
  function stopAndSend() {
    if (voiceStateRef.current !== 'recording') return;
    srRef.current?.stop();

    const mr = mediaRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAndSend(blob);
      };
      mr.stop();
    } else {
      transcribeAndSend(null);
    }
  }

  async function transcribeAndSend(blob: Blob | null) {
    setVoiceStateSynced('thinking');
    let text = '';

    // Primary: server Whisper
    if (blob && blob.size > 1200) {
      try { text = (await transcribeAudio(blob, language)).trim(); } catch { /* fall back below */ }
    }
    // Fallback: browser transcript captured while holding
    if (!text) text = srTranscriptRef.current.trim();

    if (!text) {
      setErrMsg('Didn’t catch that — hold the mic and speak clearly.');
      setVoiceStateSynced('idle');
      return;
    }
    setUserText(text);
    await askLLM(text);
  }

  const avatarState: AvatarState =
    voiceState === 'recording' ? 'listening' :
    voiceState === 'thinking'  ? 'thinking'  : 'idle';

  const isBusy      = voiceState === 'thinking';
  const isRecording = voiceState === 'recording';
  const isSpeaking  = voiceState === 'speaking';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060c18] overflow-hidden select-none">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isRecording
            ? 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(34,184,163,0.18) 0%, transparent 70%)'
            : isSpeaking
            ? 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(34,197,94,0.12) 0%, transparent 70%)'
            : isBusy
            ? 'radial-gradient(ellipse 50% 40% at 50% 45%, rgba(34,184,163,0.10) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 45% 35% at 50% 45%, rgba(34,184,163,0.06) 0%, transparent 70%)',
          transition: 'background 0.6s ease',
        }}
      />

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-safe-top py-4">
        <button
          type="button"
          onClick={() => onEnd(liveSessionRef.current)}
          aria-label="Exit voice mode"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-ink-400 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-ink-400">MA Agent · Voice</p>
          <p className="text-[10px] text-ink-600 mt-0.5">
            {isRecording ? 'Listening…' : isSpeaking ? 'Speaking…' : isBusy ? 'Processing…' : 'Hold the mic to talk'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setMuted((m) => !m); if (!muted) window.speechSynthesis?.cancel(); }}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-ink-400 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
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
              background: isRecording
                ? 'radial-gradient(circle, rgba(34,184,163,0.25) 0%, transparent 70%)'
                : isSpeaking
                ? 'radial-gradient(circle, rgba(34,197,94,0.20) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(34,184,163,0.10) 0%, transparent 70%)',
              transition: 'background 0.5s ease',
            }}
          />
          <AiAvatar state={avatarState} size={140} />
        </div>

        <div className="text-center space-y-1">
          <p className={`text-base font-semibold tracking-wide transition-colors ${
            isRecording ? 'text-brand-400' :
            isBusy      ? 'text-ink-400'   :
            isSpeaking  ? 'text-ok-400'    : 'text-ink-500'
          }`}>
            {isRecording ? 'Listening…' : isBusy ? 'Thinking…' : isSpeaking ? 'Speaking…' : 'Ready'}
          </p>
          {isBusy && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-ink-600">
              <Loader2 size={12} className="animate-spin" /> Powered by OpenRouter
            </div>
          )}
        </div>

        <Waveform active={isRecording || isSpeaking} color={isSpeaking ? 'ok' : 'brand'} />
      </div>

      {/* ── Transcript ───────────────────────────────────────────────── */}
      <div className="shrink-0 min-h-[80px] px-6 flex flex-col items-center gap-2 justify-end pb-2">
        {errMsg && (
          <div className="w-full max-w-sm rounded-2xl bg-warn-500/10 border border-warn-500/20 px-4 py-2 text-xs text-warn-400 text-center">
            {errMsg}
          </div>
        )}
        {bookedMsg && (
          <div className="w-full max-w-sm rounded-2xl bg-ok-500/10 border border-ok-500/25 px-4 py-2 text-xs text-ok-400 text-center">
            ✓ {bookedMsg}
          </div>
        )}
        {userText && (
          <div className="w-full max-w-sm rounded-2xl bg-brand-600/15 border border-brand-500/20 px-4 py-2.5 text-sm text-brand-300 text-center">
            {userText}
          </div>
        )}
        {aiText && (
          <div className="w-full max-w-sm rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-ink-200 text-center leading-relaxed">
            {aiText.length > 140 ? `${aiText.slice(0, 140)}…` : aiText}
          </div>
        )}
      </div>

      {/* ── Push-to-talk mic button (hold to speak, release to send) ──── */}
      <div
        className="shrink-0 flex flex-col items-center gap-3 py-8"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); startRecording(); }}
          onPointerUp={(e) => { e.preventDefault(); stopAndSend(); }}
          onPointerLeave={() => { if (voiceStateRef.current === 'recording') stopAndSend(); }}
          onPointerCancel={() => { if (voiceStateRef.current === 'recording') stopAndSend(); }}
          onContextMenu={(e) => e.preventDefault()}
          disabled={isBusy}
          aria-label="Hold to speak, release to send"
          className={`voice-mic-btn touch-none select-none ${isRecording ? 'voice-mic-active scale-110' : ''} ${isBusy ? 'opacity-50' : ''}`}
        >
          <Mic size={30} />
        </button>
        <p className="text-xs text-ink-600">
          {isRecording ? 'Release to send' : isBusy ? 'Please wait…' : isSpeaking ? 'Hold to interrupt & talk' : 'Hold to speak'}
        </p>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function VoiceMode() {
  const { language }   = useAppStore();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId      = searchParams.get('s') ?? undefined;

  const [selectedModel, setSelectedModel] = useState(VOICE_MODELS[0].id);
  const [showPicker, setShowPicker]       = useState(false);

  return (
    <>
      {/* Model picker */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60]">
        <button
          type="button"
          onClick={() => setShowPicker((p) => !p)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 backdrop-blur px-4 py-1.5 text-[11px] font-medium text-ink-400 hover:text-ink-200 transition"
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
                className={`w-full px-4 py-3 text-left text-xs transition hover:bg-white/5 ${selectedModel === m.id ? 'text-brand-400' : 'text-ink-200'}`}
              >
                {m.label}
                {selectedModel === m.id && <span className="float-right text-brand-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <VoiceUI
        model={selectedModel}
        sessionId={sessionId}
        language={language}
        onEnd={(sid) => navigate(sid ? `/?s=${sid}` : '/')}
      />
    </>
  );
}
