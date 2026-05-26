// Seed medical knowledge for the MVP RAG layer.
// Each entry is a small, self-contained clinical reference snippet.
// Sources: WHO essential clinical guidance, MSF Clinical Guidelines, CDC summaries.
// These are GENERAL educational summaries — not patient-specific guidance.

export interface KnowledgeDoc {
  id: string;
  title: string;
  tags: string[];
  body: string;
}

export const MEDICAL_KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: 'malaria-uncomplicated',
    title: 'Uncomplicated malaria — recognition',
    tags: ['infection', 'tropical', 'fever'],
    body:
      'Classic triad is fever, chills, sweats, often cyclical every 24-72h depending on species. ' +
      'Headache, myalgia, fatigue, nausea, vomiting are common. Physical exam may show pallor and ' +
      'splenomegaly. Confirm with rapid diagnostic test (RDT) or thick/thin blood film. Red flags ' +
      'requiring escalation to severe malaria workup: impaired consciousness, repeated seizures, ' +
      'respiratory distress, jaundice, dark urine, prostration, bleeding, hypoglycemia.',
  },
  {
    id: 'dengue-warning-signs',
    title: 'Dengue warning signs',
    tags: ['infection', 'tropical', 'fever'],
    body:
      'Suspect dengue with high fever (40C) plus two of: retro-orbital pain, myalgia/arthralgia, ' +
      'rash, leukopenia, positive tourniquet test. Warning signs (require admission): abdominal pain, ' +
      'persistent vomiting, mucosal bleeding, lethargy/restlessness, hepatomegaly >2cm, rising HCT ' +
      'with rapid platelet drop. Critical phase begins around defervescence on day 3-7.',
  },
  {
    id: 'pneumonia-adult',
    title: 'Community-acquired pneumonia (adult) — assessment',
    tags: ['respiratory', 'infection'],
    body:
      'Suspect with cough, fever, dyspnea, pleuritic chest pain, focal crackles or bronchial breath ' +
      'sounds. CRB-65 score for severity (1 point each: confusion, RR >=30, SBP <90 or DBP <=60, ' +
      'age >=65). Score 0 = outpatient, 1-2 = consider admission, 3-4 = urgent admission. ' +
      'Red flags: SpO2 <92%, hypotension, altered mental status, multilobar infiltrates.',
  },
  {
    id: 'pneumonia-child-imci',
    title: 'Child pneumonia — IMCI fast breathing thresholds',
    tags: ['pediatrics', 'respiratory'],
    body:
      'WHO IMCI fast breathing thresholds for cough/difficulty breathing: 2-12 months: >=50 ' +
      'breaths/min. 12-59 months: >=40 breaths/min. <2 months: >=60 breaths/min. Danger signs ' +
      '(severe pneumonia, refer urgently): chest indrawing, stridor at rest, central cyanosis, ' +
      'inability to drink/breastfeed, persistent vomiting, lethargy, convulsions.',
  },
  {
    id: 'acs-recognition',
    title: 'Acute coronary syndrome — recognition',
    tags: ['cardiac', 'emergency'],
    body:
      'Classic: substernal pressure/heaviness lasting >20 min, often radiating to left arm, jaw, ' +
      'or back, with diaphoresis, nausea, dyspnea. Atypical in women, elderly, diabetics — may ' +
      'present as fatigue, epigastric pain, or isolated dyspnea. Time-critical: get ECG within 10 ' +
      'min, give aspirin 300 mg chewed if no contraindication, arrange immediate transfer to a ' +
      'facility with reperfusion capability.',
  },
  {
    id: 'stroke-fast',
    title: 'Stroke screening — BE FAST',
    tags: ['neuro', 'emergency'],
    body:
      'BE FAST: Balance loss, Eye/vision change, Face droop, Arm weakness, Speech difficulty, ' +
      'Time (note last-known-well). Any positive sign warrants emergency transfer. Window for ' +
      'thrombolysis is typically 4.5h from onset, thrombectomy up to 24h in selected patients. ' +
      'Do not give aspirin until hemorrhagic stroke is excluded by imaging.',
  },
  {
    id: 'sepsis-qsofa',
    title: 'Sepsis screening — qSOFA',
    tags: ['infection', 'emergency'],
    body:
      'qSOFA: altered mental status (GCS <15), respiratory rate >=22, systolic BP <=100 mmHg. ' +
      '>=2 of 3 with suspected infection = high risk for sepsis. Initial bundle within 1 hour: ' +
      'measure lactate, blood cultures before antibiotics, broad-spectrum antibiotics, 30 mL/kg ' +
      'crystalloid for hypotension or lactate >=4, vasopressors if MAP <65 after fluids.',
  },
  {
    id: 'oral-rehydration',
    title: 'Acute diarrhea — oral rehydration plan A',
    tags: ['gi', 'pediatrics', 'hydration'],
    body:
      'WHO Plan A (no dehydration): give extra fluids — ORS, breast milk, clean water, soup. ' +
      'Under 2 years: 50-100 mL after each loose stool. 2 years and older: 100-200 mL. Continue ' +
      'feeding. Zinc 20 mg/day (10 mg if <6 months) for 10-14 days. Return immediately for: ' +
      'unable to drink, blood in stool, repeated vomiting, fever, no improvement in 3 days.',
  },
  {
    id: 'asthma-exacerbation',
    title: 'Acute asthma exacerbation — severity assessment',
    tags: ['respiratory', 'emergency'],
    body:
      'Mild-moderate: speaks in sentences, RR <30, HR <120, SpO2 >=92%, PEF >50% predicted. ' +
      'Severe: speaks in words, RR >=30, HR >=120, SpO2 <92%, PEF <50%. Life-threatening: ' +
      'silent chest, cyanosis, exhaustion, altered consciousness, SpO2 <90%, PEF <33%, ' +
      'normal/raised CO2. Treat with O2, salbutamol via spacer or nebulizer, oral or IV ' +
      'corticosteroid, ipratropium for severe cases, urgent transfer for life-threatening.',
  },
  {
    id: 'preeclampsia',
    title: 'Pre-eclampsia / eclampsia recognition',
    tags: ['obstetrics', 'emergency'],
    body:
      'Pre-eclampsia: new hypertension (SBP >=140 or DBP >=90) after 20 weeks gestation with ' +
      'proteinuria or end-organ dysfunction. Severe features: SBP >=160, DBP >=110, severe ' +
      'headache, visual changes, RUQ pain, pulmonary edema, thrombocytopenia, elevated liver ' +
      'enzymes, creatinine rise. Eclampsia = pre-eclampsia + seizure. Magnesium sulfate is the ' +
      'first-line anticonvulsant. Definitive treatment is delivery — transfer immediately.',
  },
  {
    id: 'tb-screening',
    title: 'Tuberculosis screening — WHO four-symptom screen',
    tags: ['infection', 'respiratory'],
    body:
      'Screen all adults and adolescents in high-TB settings with: current cough, fever, weight ' +
      'loss, night sweats. Any one positive triggers diagnostic workup with sputum Xpert MTB/RIF ' +
      'and CXR. Children additionally screened for poor weight gain and contact history. HIV-' +
      'positive patients should be screened at every visit.',
  },
  {
    id: 'dehydration-assessment',
    title: 'Dehydration severity in children',
    tags: ['pediatrics', 'hydration'],
    body:
      'No dehydration: alert, drinks normally, no sunken eyes, normal skin pinch. Some ' +
      'dehydration (2 or more): restless/irritable, sunken eyes, thirsty drinks eagerly, skin ' +
      'pinch goes back slowly. Severe dehydration (2 or more): lethargic/unconscious, sunken ' +
      'eyes, unable to drink or drinks poorly, skin pinch goes back very slowly (>=2s). Severe ' +
      'requires IV fluids and immediate referral.',
  },
  {
    id: 'anaphylaxis',
    title: 'Anaphylaxis recognition & first-line treatment',
    tags: ['emergency', 'allergy'],
    body:
      'Sudden onset (minutes to hours) involving skin/mucosa (urticaria, swelling) plus either ' +
      'respiratory compromise (dyspnea, wheeze, stridor), cardiovascular compromise (hypotension, ' +
      'syncope), or persistent GI symptoms after likely allergen. First-line: IM epinephrine 0.01 ' +
      'mg/kg (max 0.5 mg adult) into mid-anterolateral thigh, repeat q5-15 min as needed. ' +
      'Position supine with legs elevated. Oxygen, IV fluids. Antihistamines and steroids are ' +
      'adjuncts, NOT substitutes for epinephrine.',
  },
  {
    id: 'mental-health-suicide-risk',
    title: 'Brief suicide risk screening',
    tags: ['mental-health', 'emergency'],
    body:
      'Ask directly: "Have you been having thoughts of suicide or harming yourself?" If yes, ' +
      'assess plan, means, intent, timeline, prior attempts. High risk: specific plan, access to ' +
      'lethal means, recent loss, intoxication, severe hopelessness. High-risk patients require ' +
      'immediate safety planning, removal of means, and urgent mental-health referral or ' +
      'admission. Do not leave a high-risk patient alone.',
  },
  {
    id: 'red-flag-headache',
    title: 'Headache red flags (SNOOP10 summary)',
    tags: ['neuro', 'emergency'],
    body:
      'Red flags requiring urgent imaging or referral: systemic symptoms (fever, weight loss), ' +
      'neoplasm or HIV history, neuro deficits or altered consciousness, sudden "thunderclap" ' +
      'onset, older age (new headache >50), pattern change, positional headache, precipitated by ' +
      'Valsalva, papilledema, progressive, pregnancy/postpartum, painful eye with vision change.',
  },
];
