export { connectDB, disconnectDB, dbReady, mongoose } from './connection.js';

// Models
export { Patient }         from './models/Patient.js';
export { Facility }        from './models/Facility.js';
export { Doctor }          from './models/Doctor.js';
export { TimeSlot }        from './models/TimeSlot.js';
export { Appointment }     from './models/Appointment.js';
export { Session }         from './models/Session.js';
export { Interview }       from './models/Interview.js';
export { SymptomAnalysis } from './models/SymptomAnalysis.js';
export { TriageResult }    from './models/TriageResult.js';
export { ReportAnalysis }  from './models/ReportAnalysis.js';
export { AuditLog }        from './models/AuditLog.js';
export { RagDoc }          from './models/RagDoc.js';

// Types
export type { IPatient, IEmergencyContact } from './models/Patient.js';
export type { IFacility }        from './models/Facility.js';
export type { IDoctor }          from './models/Doctor.js';
export type { ITimeSlot }        from './models/TimeSlot.js';
export type { IAppointment, AppointmentStatus, IAgentAnalysis } from './models/Appointment.js';
export type { ISession }         from './models/Session.js';
export type { IInterview }       from './models/Interview.js';
export type { ISymptomAnalysis } from './models/SymptomAnalysis.js';
export type { ITriageResult }    from './models/TriageResult.js';
export type { IReportAnalysis }  from './models/ReportAnalysis.js';
export type { IAuditLog }        from './models/AuditLog.js';
export type { IRagDoc }          from './models/RagDoc.js';
