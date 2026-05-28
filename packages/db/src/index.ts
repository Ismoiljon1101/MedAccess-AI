export { connectDB, disconnectDB, dbReady, mongoose } from './connection.js';

// Models
export { Role }            from './models/Role.js';
export { Permission }      from './models/Permission.js';
export { Clinic }          from './models/Clinic.js';
export { User }            from './models/User.js';
export { Patient }         from './models/Patient.js';
export { Medication }      from './models/Medication.js';
export { Allergy }         from './models/Allergy.js';
export { Condition }       from './models/Condition.js';
export { Encounter }       from './models/Encounter.js';
export { Vitals }          from './models/Vitals.js';
export { Interview }       from './models/Interview.js';
export { SymptomAnalysis } from './models/SymptomAnalysis.js';
export { TriageResult }    from './models/TriageResult.js';
export { ReportAnalysis }  from './models/ReportAnalysis.js';
export { Session }         from './models/Session.js';
export { AuditLog }        from './models/AuditLog.js';
export { RagDoc }          from './models/RagDoc.js';
export { Referral }        from './models/Referral.js';

// v0.2 facility-based models
export { Facility }        from './models/Facility.js';
export { Doctor }          from './models/Doctor.js';
export { TimeSlot }        from './models/TimeSlot.js';
export { Appointment }     from './models/Appointment.js';

// Types
export type { IRole }            from './models/Role.js';
export type { IPermission }      from './models/Permission.js';
export type { IClinic }          from './models/Clinic.js';
export type { IUser }            from './models/User.js';
export type { IPatient, IEmergencyContact } from './models/Patient.js';
export type { IMedication }      from './models/Medication.js';
export type { IAllergy }         from './models/Allergy.js';
export type { ICondition }       from './models/Condition.js';
export type { IEncounter }       from './models/Encounter.js';
export type { IVitals }          from './models/Vitals.js';
export type { IInterview }       from './models/Interview.js';
export type { ISymptomAnalysis } from './models/SymptomAnalysis.js';
export type { ITriageResult }    from './models/TriageResult.js';
export type { IReportAnalysis }  from './models/ReportAnalysis.js';
export type { ISession }         from './models/Session.js';
export type { IAuditLog }        from './models/AuditLog.js';
export type { IRagDoc }          from './models/RagDoc.js';
export type { IReferral }        from './models/Referral.js';

// v0.2 types
export type { IFacility }        from './models/Facility.js';
export type { IDoctor }          from './models/Doctor.js';
export type { ITimeSlot }        from './models/TimeSlot.js';
export type { IAppointment, AppointmentStatus } from './models/Appointment.js';
