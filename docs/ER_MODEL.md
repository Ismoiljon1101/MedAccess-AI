# ER Model — MedAccess AI (Post-MVP)

> **Note:** Current MVP (v0.1.0) has NO database. This ER model is for the **planned production architecture** after submission. See [TODO.md](../TODO.md#9--deferred-post-competition) for the roadmap.

```mermaid
erDiagram
    USER ||--o{ SESSION : "creates"
    USER ||--o{ AUDIT_LOG : "generates"
    USER }o--|| ROLE : "has"
    ROLE ||--o{ PERMISSION : "grants"

    CLINIC ||--o{ USER : "employs"
    CLINIC ||--o{ PATIENT : "registers"

    USER ||--o{ PATIENT : "treats (clinician)"
    PATIENT ||--o{ ENCOUNTER : "has"
    PATIENT ||--o{ MEDICATION : "takes"
    PATIENT ||--o{ ALLERGY : "has"
    PATIENT ||--o{ CONDITION : "diagnosed_with"

    ENCOUNTER ||--o{ INTERVIEW : "contains"
    ENCOUNTER ||--o{ SYMPTOM_ANALYSIS : "contains"
    ENCOUNTER ||--o{ TRIAGE_RESULT : "contains"
    ENCOUNTER ||--o{ REPORT_ANALYSIS : "contains"
    ENCOUNTER ||--o{ VITALS : "records"

    INTERVIEW ||--o{ MESSAGE : "has"
    MESSAGE }o--o{ CITATION : "references"
    CITATION }|--|| RAG_DOC : "cites"

    REPORT_ANALYSIS ||--|| IMAGE_UPLOAD : "from"
    REPORT_ANALYSIS ||--o{ VISION_FINDING : "produces"

    SYMPTOM_ANALYSIS ||--o{ DIFFERENTIAL : "ranks"

    USER {
        uuid id PK
        string email UK
        string passwordHash
        uuid roleId FK
        uuid clinicId FK
        string locale
        timestamp createdAt
        timestamp lastLoginAt
    }
    ROLE {
        uuid id PK
        string name "patient|clinician|admin|specialist"
        string description
    }
    PERMISSION {
        uuid id PK
        string resource "patient|encounter|audit"
        string action "read|write|delete|sign"
    }
    CLINIC {
        uuid id PK
        string name
        string country
        string language
        json settings
    }
    PATIENT {
        uuid id PK
        uuid clinicId FK
        uuid primaryClinicianId FK
        int age
        string sex
        boolean pregnancy
        string preferredLanguage
        timestamp createdAt
    }
    ENCOUNTER {
        uuid id PK
        uuid patientId FK
        uuid clinicianId FK
        string status "open|signed|closed"
        timestamp startedAt
        timestamp closedAt
    }
    INTERVIEW {
        uuid id PK
        uuid encounterId FK
        string sessionId
        string language
        string model
    }
    MESSAGE {
        uuid id PK
        uuid interviewId FK
        string role "user|assistant"
        text content
        timestamp createdAt
    }
    SYMPTOM_ANALYSIS {
        uuid id PK
        uuid encounterId FK
        string urgency
        string model
        timestamp createdAt
    }
    DIFFERENTIAL {
        uuid id PK
        uuid analysisId FK
        string condition
        string likelihood
        float probabilityPct
        text reasoning
    }
    TRIAGE_RESULT {
        uuid id PK
        uuid encounterId FK
        string level "RED|ORANGE|YELLOW|GREEN|BLUE"
        string targetTimeToCare
        text rationale
    }
    REPORT_ANALYSIS {
        uuid id PK
        uuid encounterId FK
        uuid imageId FK
        string imageType
        text qualityNotes
        string model
    }
    VISION_FINDING {
        uuid id PK
        uuid reportId FK
        string finding
        string confidence
    }
    IMAGE_UPLOAD {
        uuid id PK
        string url
        string mimeType
        int sizeBytes
        timestamp uploadedAt
    }
    VITALS {
        uuid id PK
        uuid encounterId FK
        int hrBpm
        int sbpMmHg
        int spo2Pct
        float tempC
    }
    MEDICATION {
        uuid id PK
        uuid patientId FK
        string name
        string dose
    }
    ALLERGY {
        uuid id PK
        uuid patientId FK
        string allergen
    }
    CONDITION {
        uuid id PK
        uuid patientId FK
        string name
        date diagnosedAt
    }
    SESSION {
        uuid id PK
        uuid userId FK
        string token
        timestamp expiresAt
    }
    AUDIT_LOG {
        uuid id PK
        uuid userId FK
        string action
        string resource
        json metadata
        timestamp createdAt
    }
    RAG_DOC {
        uuid id PK
        string title
        text content
        json tags
        timestamp indexedAt
    }
    CITATION {
        uuid id PK
        uuid messageId FK
        uuid ragDocId FK
        float score
    }
```

## Key Design Decisions

1. **Multi-tenant:** `clinicId` on `USER`, `PATIENT`, `ENCOUNTER` ensures clinic isolation.
2. **RBAC:** `ROLE` + `PERMISSION` for granular access (clinician ≠ admin ≠ patient).
3. **Encounter-centric:** All analysis (interview, symptoms, triage, reports) tie to an `ENCOUNTER`, never to a patient alone.
4. **Audit trail:** Every user action logged in `AUDIT_LOG` for compliance (HIPAA, GDPR).
5. **Soft deletes:** Add `deletedAt` timestamp to all tables for data retention.
6. **RAG upgrade:** When corpus grows past ~200 docs, add `RAG_EMBEDDING` table with pgvector embeddings.

## Migration Path from MVP

1. Create `CLINIC` seed record.
2. Backfill `USER` from auth signup log (currently none).
3. Add `clinicId` to all session-based requests.
4. Migrate in-memory sessions → Redis (no schema change).
5. Add auth middleware: `requireUser()`, `requireRole('clinician')`.
