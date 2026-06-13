import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Phone, Plus, Headphones, BookText, Image as ImageIcon, MapPin, X, Brain, CheckCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AiAvatar, type AvatarState } from '@/components/AiAvatar';
import ImageCaptureFlow from '@/components/ImageCaptureFlow';
import type { ImageModality } from '@/components/ImageCaptureFlow';
import BookingFlow from '@/components/BookingFlow';
import { streamChatRequest, loadSession, analyzeReport, bookAppointment } from '@/lib/api';
import { useAppStore } from '@/store/app';

interface RagCitation {
  id: string;
  title: string;
  score: number;
}

interface BookingAction {
  doctorId: string;
  doctorName: string;
  facilityId: string;
  facilityName?: string;
  specialty: string;
  reason: string;
  // Present when the agent booked conversationally (real injected slot) → auto-book silently.
  date?: string;
  time?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  citations?: RagCitation[];
  imageUrl?: string;
  imageName?: string;
  bookingAction?: BookingAction;
}

const GREETING: Message = {
  id: 'greeting',
  role: 'assistant',
  content:
    "Hi, I'm MA Agent — your MedAccess AI health companion. Tell me what's bothering you today and I'll help you understand what might be going on. You can type, speak, or upload a medical image.",
};

export default function Chat() {
  const { language, upsertSession, patientProfile, addAppointment, voiceAutoPlay } = useAppStore();
  const patientPhone = patientProfile?.phone;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const resumeId = searchParams.get('s') ?? undefined;

  const [messages, setMessages]       = useState<Message[]>([GREETING]);
  const [input, setInput]             = useState('');
  const [sessionId, setSessionId]     = useState<string | undefined>(resumeId);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [loadError, setLoadError]     = useState<string | null>(null);

  const [ctaSpec, setCtaSpec] = useState<{ specialty: string; urgency: string } | null>(null);
  const [pendingBooking, setPendingBooking] = useState<BookingAction | null>(null);
  // In-chat booking picker (clinic + time). Opened from a care CTA or a <<BOOK>> suggestion.
  const [bookingSession, setBookingSession] = useState<{
    specialty: string;
    urgency: string;
    reason?: string;
    preferredDoctorId?: string;
    preferredFacilityId?: string;
  } | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState<{ date: string; time: string } | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [isReasoning, setIsReasoning] = useState(false);

  // Geolocation — acquired once on mount, passed with every chat request
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef     = useRef<AbortController | null>(null);
  // Track first user message for history preview
  const previewRef  = useRef<string>('');
  const msgCountRef = useRef<number>(0);
  // Count user turns (not counting greeting)
  const userTurnRef = useRef<number>(0);
  // Track created object URLs so we can revoke them on unmount (C11a) — a cleanup
  // effect that closes over `messages` would only ever see the initial empty array.
  const objectUrlsRef = useRef<string[]>([]);

  // ── Parse booking marker from text ───────────────────────────────
  function parseBookingMarker(text: string): { cleanText: string; booking?: BookingAction } {
    const match = text.match(/<<BOOK:([\s\S]*?)>>/);
    if (!match) return { cleanText: text };
    // Always strip the marker from the visible message, even if the payload is malformed.
    const cleanText = text.replace(/<<BOOK:[\s\S]*?>>/, '').trim();

    let payload: any;
    try {
      payload = JSON.parse(match[1]);
    } catch {
      // Models routinely emit JS-object style with unquoted keys — normalize then retry.
      try {
        payload = JSON.parse(match[1].replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":'));
      } catch {
        return { cleanText };
      }
    }

    if (!payload?.doctorId || !payload?.facilityId) return { cleanText };
    return {
      cleanText,
      booking: {
        doctorId: payload.doctorId,
        doctorName: payload.doctorName,
        facilityId: payload.facilityId,
        facilityName: payload.facilityName,
        specialty: payload.specialty,
        reason: payload.reason,
        date: payload.date,
        time: payload.time,
      },
    };
  }

  // ── Clinical Snapshot CTA detection ──────────────────────────────────
  function detectClinicalSnapshot(text: string, userTurns: number): { specialty: string; urgency: string } | null {
    if (userTurns < 3) return null;
    const t = text.toLowerCase();
    const clinicalKeywords = ['recommend', 'consult', 'specialist', 'clinic', 'doctor', 'appointment',
      'see a ', 'urgent', 'emergency', 'diagnosis', 'condition', 'treatment', 'follow up', 'seek care',
      'medical attention', 'possible cause', 'likely cause', 'suggest', 'refer'];
    const hasClinical = clinicalKeywords.some((k) => t.includes(k));
    if (!hasClinical) return null;

    return { specialty: detectSpecialty(t), urgency: detectUrgency(t) };
  }

  function detectUrgency(t: string): string {
    if (/emergency|immediately|call 9|call 1|life.threaten/i.test(t)) return 'emergency';
    if (/urgent|as soon as possible|asap|right away/i.test(t)) return 'urgent';
    if (/self.care|home remedy|rest at home|over.the.counter/i.test(t)) return 'self-care';
    return 'see-clinician-soon';
  }

  function detectSpecialty(t: string): string {
    if (/heart|cardiac|chest pain|palpitation|cardiovascular/i.test(t)) return 'Cardiology';
    if (/headache|migraine|neurolog|seizure|stroke|nerve/i.test(t)) return 'Neurology';
    if (/breath|respiratory|lung|asthma|pulmon|cough/i.test(t)) return 'Respiratory';
    if (/mental|anxiety|depress|psychiatr|psycholog/i.test(t)) return 'Mental Health';
    if (/child|pediatr|infant|baby/i.test(t)) return 'Pediatrics';
    if (/skin|lesion|rash|melanom|dermat|mole/i.test(t)) return 'Dermatology';
    if (/eye|retina|fundus|vision|diabetic retino/i.test(t)) return 'Ophthalmology';
    if (/x.?ray|pneumon|lung|chest/i.test(t)) return 'Pulmonology';
    if (/urgent care|minor injur|wound/i.test(t)) return 'Urgent Care';
    if (/emergency|trauma/i.test(t)) return 'Emergency';
    return 'General Practice';
  }

  // ── Image analysis → urgency + specialty detection ───────────────────
  function detectImageUrgency(result: import('@/lib/api').ReportAnalysisResult): { specialty: string; urgency: string } | null {
    const findings = result.findings || [];
    const hasHighConf = findings.some((f) => f.confidence === 'high');
    const hasModConf = findings.some((f) => f.confidence === 'moderate');

    // Always suggest care if there are real findings
    if (!hasHighConf && !hasModConf && findings.length === 0) return null;

    // Urgency: high confidence finding = urgent, moderate = see-clinician-soon
    const urgency = hasHighConf ? 'urgent' : 'see-clinician-soon';

    // Specialty from image type
    const t = (result.imageType + ' ' + findings.map((f) => f.finding).join(' ')).toLowerCase();
    const specialty = detectSpecialty(t);

    return { specialty, urgency };
  }

  // ── Load resumed session ──────────────────────────────────────────────
  useEffect(() => {
    if (!resumeId) return;
    loadSession(resumeId)
      .then((msgs) => {
        if (!msgs.length) return;
        setMessages(
          // Defense for sessions saved before the server-side strip landed: never
          // render a stray <<BOOK>> marker to the patient on resume.
          msgs.map((m) => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.role === 'assistant' ? parseBookingMarker(m.content).cleanText : m.content,
          })),
        );
        msgCountRef.current = msgs.length;
        // Restore the user-turn count so the care CTA can still appear without
        // forcing 3 brand-new turns after a resume (C11b).
        userTurnRef.current = msgs.filter((m) => m.role === 'user').length;
        const firstUser = msgs.find((m) => m.role === 'user');
        if (firstUser) previewRef.current = firstUser.content.slice(0, 80);
      })
      .catch(() => setLoadError('Session not found or expired. Starting a new chat.'));
  }, [resumeId]);

  // ── Geolocation (silent, best-effort) ────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => { /* permission denied — fine, booking proposal won't include GPS */ },
      { timeout: 5000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Revoke object URLs on unmount (memory cleanup) ────────────────────
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // ── Auto-resize textarea ─────────────────────────────────────────────
  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  // ── Persist session metadata to store ────────────────────────────────
  function persistSession(sid: string, extraCount = 0) {
    msgCountRef.current += extraCount;
    upsertSession({
      sessionId:    sid,
      preview:      previewRef.current || 'New chat',
      messageCount: msgCountRef.current,
      language,
      createdAt:    Date.now(),
    });
  }

  // ── Send / stream message ─────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Save first user message as preview
      if (!previewRef.current) previewRef.current = trimmed.slice(0, 80);
      userTurnRef.current += 1;

      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      const userId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: userId, role: 'user', content: trimmed }]);
      setAvatarState('thinking');

      const aiId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: aiId, role: 'assistant', content: '', streaming: true },
      ]);

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        let assembled = '';
        let resolvedSid = sessionId;
        let streamError: string | null = null;

        let resolvedCitations: RagCitation[] = [];

        for await (const event of streamChatRequest(trimmed, sessionId, language, {
          patientPhone: patientPhone ?? undefined,
          lat: locationRef.current?.lat,
          lng: locationRef.current?.lng,
          signal: ctrl.signal,
        })) {
          if (ctrl.signal.aborted) break;
          if (event.type === 'meta') {
            if (event.data.sessionId) {
              resolvedSid = event.data.sessionId;
              setSessionId(resolvedSid);
            }
            if (event.data.citations?.length) {
              resolvedCitations = event.data.citations;
            }
          } else if (event.type === 'thinking_start') {
            setIsReasoning(true);
          } else if (event.type === 'thinking_end') {
            setIsReasoning(false);
          } else if (event.type === 'token') {
            assembled += event.data.delta ?? '';
            // Strip booking marker during streaming for display
            const { cleanText } = parseBookingMarker(assembled);
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: cleanText } : m)),
            );
          } else if (event.type === 'error') {
            streamError = event.data?.message ?? 'error';
            break;
          } else if (event.type === 'done') {
            break;
          }
        }

        // Parse booking marker from final text
        const { cleanText, booking } = parseBookingMarker(assembled);

        // Stream failed with nothing usable → show an error, not an empty bubble.
        const finalContent = (streamError && !cleanText.trim())
          ? "Sorry — I couldn't reach the AI service. Please try again in a moment."
          : cleanText;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, streaming: false, citations: resolvedCitations.length ? resolvedCitations : undefined, content: finalContent, bookingAction: booking }
              : m,
          ),
        );

        // Booking action: conversational (has real slot) → book silently;
        // otherwise fall back to the in-chat picker card.
        if (booking) {
          if (booking.date && booking.time) autoBook(booking);
          else setPendingBooking(booking);
        }

        // Optional: speak the answer aloud when auto-play is on (C17).
        if (voiceAutoPlay && finalContent && !streamError && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(finalContent));
        }

        // Check for clinical snapshot → show Connect to Care CTA
        const snap = detectClinicalSnapshot(cleanText, userTurnRef.current);
        if (snap) setCtaSpec(snap);

        // Persist to local history
        if (resolvedSid) persistSession(resolvedSid, 2); // +user +assistant
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, content: "Sorry, I couldn't reach the server. Please try again.", streaming: false }
                : m,
            ),
          );
        }
      } finally {
        setAvatarState('idle');
        setIsReasoning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, language, patientPhone],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  // ── Inline mic intentionally removed ─────────────────────────────────
  // DO NOT re-add an inline Web Speech mic button to the chat bar. Browser
  // SpeechRecognition was unreliable across devices/locales (Korea, mobile
  // Safari). Hands-free voice lives in the dedicated VoiceMode screen
  // (headphones button) which uses the server pipeline. Keep text + that.

  // Store latest image analysis for attaching to referral
  const lastImageAnalysisRef = useRef<import('@/lib/api').ReportAnalysisResult | null>(null);

  // ── Build a rich, clinician-facing summary from the whole conversation ──
  // This is what the doctor sees on the Patient Queue — keep it substantive.
  function buildAgentSummary(specialty: string, reason?: string): string {
    const parts: string[] = [`MA Agent referral · ${specialty}`];
    if (reason) parts.push(`Reason: ${reason}`);

    const convo = messages.filter((m) => m.id !== 'greeting');
    const patientLines = convo
      .filter((m) => m.role === 'user' && m.content.trim())
      .map((m) => m.content.trim());
    if (patientLines.length) {
      parts.push('', 'Patient described:');
      patientLines.forEach((l) => parts.push(`• ${l}`));
    }

    const lastAssistant = [...convo].reverse().find((m) => m.role === 'assistant' && m.content.trim());
    if (lastAssistant) {
      parts.push('', 'Agent assessment:', lastAssistant.content.trim());
    }

    const a = lastImageAnalysisRef.current;
    if (a) {
      parts.push('', `AI image analysis — ${a.imageType}:`);
      a.findings.forEach((f) => parts.push(`• ${f.finding} (${f.confidence})${f.notes ? ': ' + f.notes : ''}`));
      if (a.suggestedFollowUp.length) parts.push(`Follow-up: ${a.suggestedFollowUp.join('; ')}`);
    }

    return parts.join('\n').slice(0, 4000);
  }

  // ── Open the in-chat booking picker (clears competing cards) ──────────
  function openBooking(spec: { specialty: string; urgency: string; reason?: string; preferredDoctorId?: string; preferredFacilityId?: string }) {
    setCtaSpec(null);
    setPendingBooking(null);
    setBookingSession(spec);
  }

  function handleBooked(result: { date: string; time: string; doctorName: string; facilityName: string }) {
    setBookingConfirmed({ date: result.date, time: result.time });
  }

  // ── Conversational booking: agent emitted a real slot → book silently ─────
  async function autoBook(booking: BookingAction) {
    if (!booking.date || !booking.time) return;
    // No identity → can't complete server-side; fall back to the in-chat picker.
    if (!patientPhone) { setPendingBooking(booking); return; }
    try {
      const imageReportId = lastImageAnalysisRef.current?.reportId;
      // Carry the urgency we detected for this conversation (don't under-triage
      // every chat-booked referral to "soon"). Fall back to the marker default.
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim());
      const urgency = ctaSpec?.urgency ?? (lastAssistant ? detectUrgency(lastAssistant.content) : 'see-clinician-soon');
      const result = await bookAppointment({
        patientPhone,
        doctorId:      booking.doctorId,
        facilityId:    booking.facilityId,
        specialty:     booking.specialty,
        urgency,
        scheduledDate: booking.date,
        scheduledTime: booking.time,
        agentSummary:  buildAgentSummary(booking.specialty, booking.reason),
        agentAnalysis: imageReportId ? { imageReportId } : undefined,
        sessionId,
      });
      setBookingConfirmed({ date: result.scheduledDate, time: result.scheduledTime });
      addAppointment({
        appointmentId:    result.appointmentId,
        facilityId:       booking.facilityId,
        facilityName:     booking.facilityName ?? '',
        doctorId:         booking.doctorId,
        doctorName:       booking.doctorName,
        specialty:        booking.specialty,
        date:             result.scheduledDate,
        startTime:        result.scheduledTime,
        endTime:          result.scheduledEndTime,
        scheduledDate:    result.scheduledDate,
        scheduledTime:    result.scheduledTime,
        scheduledEndTime: result.scheduledEndTime,
        status:           'pending',
        bookedAt:         Date.now(),
      });
    } catch {
      // Slot taken or transient error — fall back to the picker so the patient can retry.
      setPendingBooking(booking);
    }
  }

  async function handleCaptureConfirm(file: File, modality: ImageModality) {
    setShowCapture(false);
    // Pass the chosen modality as a hint so the sidecar routes to the right
    // specialist model instead of guessing (C15). 'general' = let it auto-detect.
    const modalityNote = modality === 'general' ? undefined : modality;

    const userId   = crypto.randomUUID();
    const imageName = file.name || 'image.jpg';
    const imageUrl  = URL.createObjectURL(file);
    objectUrlsRef.current.push(imageUrl);
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: '', imageUrl, imageName }]);

    const aiId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: aiId, role: 'assistant', content: '', streaming: true }]);

    try {
      const result = await analyzeReport(file, language, sessionId, patientPhone, modalityNote);
      // Store for referral attachment
      lastImageAnalysisRef.current = result;

      const analysisText = [
        '**Medical Image Analysis:**',
        `- Type: ${result.imageType}`,
        `- Quality: ${result.qualityNotes}`,
        '',
        '**Key Observations:**',
        ...result.keyObservations.map((o) => `- ${o}`),
        '',
        '**Findings:**',
        ...result.findings.map((f) => `- ${f.finding} (${f.confidence})${f.notes ? ': ' + f.notes : ''}`),
        '',
        '**Suggested Follow-Up:**',
        ...result.suggestedFollowUp.map((s) => `- ${s}`),
        '',
        `_${result.disclaimer}_`,
      ].join('\n');

      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, content: analysisText, streaming: false } : m)),
      );

      // ── CONNECTION 1: Image analysis → trigger Find Care CTA ──────
      // If findings are serious, auto-show CTA — no need for 3 chat turns
      const imageSnap = detectImageUrgency(result);
      if (imageSnap) {
        setCtaSpec(imageSnap);
        // Also store analysis summary as preview for referral
        if (!previewRef.current) {
          previewRef.current = `Image analysis: ${result.imageType} — ${result.findings.map((f) => f.finding).join(', ') || 'see report'}`;
        }
      }

      if (sessionId) persistSession(sessionId, 1);
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, content: `Error analyzing image: ${err.message}`, streaming: false } : m,
        ),
      );
    } finally {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function startNewChat() {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    previewRef.current = '';
    msgCountRef.current = 0;
    userTurnRef.current = 0;
    setMessages([GREETING]);
    setInput('');
    setSessionId(undefined);
    setLoadError(null);
    setAvatarState('idle');
    setIsReasoning(false);
    setCtaSpec(null);
    navigate('/');
  }

  const isThinking = avatarState === 'thinking';

  const lastAiIdx = messages.reduce<number>(
    (acc, msg, i) => (msg.role === 'assistant' ? i : acc),
    -1,
  );

  return (
    <div className="chat-layout">
      {/* ── Image capture flow (modal) ─────────────────────────────── */}
      {showCapture && (
        <ImageCaptureFlow
          onConfirm={handleCaptureConfirm}
          onCancel={() => setShowCapture(false)}
        />
      )}
      {/* ── Top bar: New chat button (only when session active) ───── */}
      {(sessionId || resumeId) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-ink-700 shrink-0">
          <span className="text-xs text-ink-500 truncate">
            {previewRef.current || 'Active session'}
          </span>
          <button
            type="button"
            onClick={startNewChat}
            className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-700 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:border-brand-500/50 transition"
          >
            <Plus size={13} /> New chat
          </button>
        </div>
      )}

      {/* ── Session load error ───────────────────────────────────── */}
      {loadError && (
        <div className="mx-3 mt-3 rounded-xl border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-xs text-warn-400 shrink-0">
          {loadError}
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const isLastAi = msg.role === 'assistant' && idx === lastAiIdx;
          const thisState: AvatarState = isLastAi
            ? msg.streaming ? 'thinking' : avatarState
            : 'idle';

          return (
            <div key={msg.id} className="flex flex-col">
              <div className={`chat-row ${msg.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}>
                {msg.role === 'assistant' && (
                  <div className="chat-avatar-wrap">
                    <AiAvatar state={thisState} size={56} />
                  </div>
                )}
                <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                  {msg.imageUrl && (
                    <div className="mb-1.5">
                      <img
                        src={msg.imageUrl}
                        alt={msg.imageName ?? 'Uploaded image'}
                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                        loading="lazy"
                      />
                      {msg.imageName && (
                        <p className="mt-1 text-[10px] text-ink-400 truncate max-w-[200px]">
                          {msg.imageName}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reasoning indicator: model is thinking / generating first token */}
                  {isLastAi && msg.streaming && !msg.content && (
                    <div className="flex items-center gap-2 text-xs text-brand-400">
                      <Brain size={13} className="shrink-0 animate-pulse" />
                      <span className="animate-pulse">{isReasoning ? 'Reasoning…' : 'Thinking…'}</span>
                      <span className="chat-typing scale-75 origin-left"><span /><span /><span /></span>
                    </div>
                  )}

                  {/* Message content — rendered as markdown */}
                  {msg.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p:      ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                        ul:     ({ children }) => <ul className="mb-1.5 ml-3 space-y-0.5 list-disc">{children}</ul>,
                        ol:     ({ children }) => <ol className="mb-1.5 ml-3 space-y-0.5 list-decimal">{children}</ol>,
                        li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        em:     ({ children }) => <em className="italic text-ink-200">{children}</em>,
                        h3:     ({ children }) => <h3 className="font-semibold text-white mt-2 mb-1">{children}</h3>,
                        h4:     ({ children }) => <h4 className="font-medium text-ink-200 mt-1.5 mb-0.5">{children}</h4>,
                        code:   ({ children }) => <code className="rounded bg-ink-700 px-1 py-0.5 text-[11px] font-mono text-brand-300">{children}</code>,
                        hr:     () => <hr className="my-2 border-ink-600" />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : null}
                </div>
              </div>
              {msg.role === 'assistant' && !msg.streaming && msg.citations?.length ? (
                <div className="ml-[68px] mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-500">
                    <BookText size={10} /> sources
                  </span>
                  {msg.citations.map((c) => (
                    <span
                      key={c.id}
                      title={`Relevance: ${c.score}`}
                      className="inline-flex items-center rounded-full border border-brand-500/25 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-400"
                    >
                      {c.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* ── In-chat booking picker (clinic + time) ────────────────── */}
      {bookingSession && !bookingConfirmed && (
        <BookingFlow
          specialty={bookingSession.specialty}
          urgency={bookingSession.urgency}
          lat={locationRef.current?.lat}
          lng={locationRef.current?.lng}
          patientPhone={patientPhone}
          sessionId={sessionId}
          agentSummary={buildAgentSummary(bookingSession.specialty, bookingSession.reason)}
          imageReportId={lastImageAnalysisRef.current?.reportId}
          preferredDoctorId={bookingSession.preferredDoctorId}
          preferredFacilityId={bookingSession.preferredFacilityId}
          onBooked={handleBooked}
          onClose={() => setBookingSession(null)}
        />
      )}

      {/* ── Booking card (inline agent-suggested doctor) ──────────── */}
      {pendingBooking && !bookingSession && !isThinking && (
        <div className="shrink-0 mx-3 mb-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-300">{pendingBooking.doctorName}</p>
            <p className="text-[11px] text-ink-400">{pendingBooking.specialty}</p>
            {pendingBooking.reason && (
              <p className="text-[10px] text-ink-500 mt-0.5 italic">{pendingBooking.reason}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => openBooking({
              specialty: pendingBooking.specialty,
              urgency: 'see-clinician-soon',
              reason: pendingBooking.reason,
              preferredDoctorId: pendingBooking.doctorId,
              preferredFacilityId: pendingBooking.facilityId,
            })}
            className="shrink-0 rounded-xl border border-brand-500/40 bg-brand-600/20 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-600/30 transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
          >
            Book Now →
          </button>
          <button
            type="button"
            onClick={() => setPendingBooking(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Booking confirmed toast ──────────────────────────────── */}
      {bookingConfirmed && (
        <div className="shrink-0 mx-3 mb-1 rounded-2xl border border-ok-500/40 bg-ok-500/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle size={18} className="text-ok-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ok-300">Appointment Booked</p>
            <p className="text-[11px] text-ink-400 mt-0.5">{bookingConfirmed.date} at {bookingConfirmed.time}</p>
          </div>
          <button type="button" onClick={() => setBookingConfirmed(null)} className="text-ink-500 hover:text-ink-200 transition">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Connect to Care CTA ──────────────────────────────────── */}
      {ctaSpec && !isThinking && !bookingSession && (
        <div className="shrink-0 mx-3 mb-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 flex items-center gap-2">
          <MapPin size={16} className="text-brand-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-300">Ready to see a {ctaSpec.specialty} provider?</p>
            <p className="text-[11px] text-ink-400 truncate">Find clinics and book an appointment near you</p>
          </div>
          <button
            type="button"
            onClick={() => openBooking({ specialty: ctaSpec.specialty, urgency: ctaSpec.urgency })}
            className="shrink-0 rounded-xl border border-brand-500/40 bg-brand-600/20 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-600/30 transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
          >
            Book Care →
          </button>
          <button
            type="button"
            onClick={() => setCtaSpec(null)}
            aria-label="Dismiss recommendation"
            title="Dismiss"
            className="shrink-0 rounded-full p-1 text-ink-500 hover:text-ink-200 hover:bg-ink-700/60 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Emergency pill ───────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] shrink-0">
        <Phone size={11} className="text-danger-400 shrink-0" />
        <span className="text-ink-500">Life-threatening?</span>
        <a href="tel:119" className="font-semibold text-danger-400">119 · 911 · 999</a>
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div className="chat-input-bar">
        {/* Image capture — opens quality-gated flow */}
        <button
          type="button"
          onClick={() => setShowCapture(true)}
          aria-label="Upload medical image"
          title="Upload image"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-ink-400 transition hover:border-brand-500/50 hover:text-ink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
        >
          <ImageIcon size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input-field"
          rows={1}
          placeholder="Describe your symptoms…"
          value={input}
          onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
          onKeyDown={handleKeyDown}
          disabled={isThinking}
        />

        {/* Inline mic removed — see note above toggleInlineMic. Use VoiceMode. */}

        {/* Full immersive voice mode */}
        <button
          type="button"
          onClick={() => navigate(`/voice${sessionId ? `?s=${sessionId}` : ''}`)}
          aria-label="Full voice mode"
          title="Hands-free voice conversation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-500/40 bg-brand-600/15 text-brand-400 transition hover:bg-brand-600/25 hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-95"
        >
          <Headphones size={18} />
        </button>

        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isThinking}
          aria-label="Send"
          className="chat-send-btn"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
