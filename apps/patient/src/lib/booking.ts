// Shared parsing for the conversational <<BOOK:{…}>> marker the agent emits.
// Used by both the text Chat and VoiceMode so neither ever shows/speaks the raw
// marker, and both can turn an agreed slot into a real appointment.

export interface BookingMarker {
  doctorId: string;
  doctorName?: string;
  facilityId: string;
  facilityName?: string;
  specialty?: string;
  reason?: string;
  date?: string;
  time?: string;
}

export interface ParsedBooking {
  cleanText: string;
  booking?: BookingMarker;
}

/** Strip the booking marker from visible text and (best-effort) parse its payload. */
export function parseBookingMarker(text: string): ParsedBooking {
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
