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

  // ── Expanded knowledge base (v2) ────────────────────────────────────────

  {
    id: 'upper-respiratory-infection',
    title: 'Upper respiratory tract infection (common cold)',
    tags: ['respiratory', 'infection'],
    body:
      'Symptoms: runny or blocked nose, sore throat, sneezing, mild cough, low-grade fever, ' +
      'headache, mild fatigue. Usually viral (rhinovirus, coronavirus). Antibiotics are NOT ' +
      'indicated. Treatment is supportive: rest, fluids, saline nasal rinse, paracetamol or ' +
      'ibuprofen for fever/pain. Red flags requiring medical review: high fever >39°C, severe ' +
      'unilateral throat pain (peritonsillar abscess), difficulty breathing, symptoms lasting ' +
      '>10 days or worsening after day 5, ear pain or hearing loss, stiff neck.',
  },

  {
    id: 'covid19-symptoms',
    title: 'COVID-19 — symptom recognition and red flags',
    tags: ['infection', 'respiratory', 'fever'],
    body:
      'Common: fever, dry cough, fatigue, loss of smell/taste (anosmia/ageusia), sore throat, ' +
      'headache, muscle aches, diarrhea. Severe disease indicators: dyspnea, persistent chest ' +
      'pain or pressure, SpO2 <94% on room air, confusion, inability to stay awake, cyanosis. ' +
      'High-risk groups: age >60, obesity, diabetes, cardiovascular disease, immunosuppression, ' +
      'chronic lung disease. Isolate if symptomatic. Seek emergency care for any severe signs.',
  },

  {
    id: 'hypertension-urgency',
    title: 'Hypertension urgency vs emergency',
    tags: ['cardiac', 'emergency'],
    body:
      'Urgency: BP >=180/110 without acute organ damage — headache, nausea, anxiety. Manage with ' +
      'oral antihypertensives, monitor, no need for immediate IV treatment. Emergency (crisis): ' +
      'same severe BP with end-organ damage — hypertensive encephalopathy (confusion, seizures), ' +
      'acute pulmonary edema, aortic dissection (tearing back pain), NSTEMI/STEMI, eclampsia. ' +
      'Emergency requires IV antihypertensives and ICU. Do not lower BP too rapidly — target ' +
      '15-25% reduction in first hour.',
  },

  {
    id: 'diabetes-recognition',
    title: 'Diabetes mellitus — recognition and acute complications',
    tags: ['metabolic', 'emergency'],
    body:
      'Classic presentation: polyuria, polydipsia, polyphagia, unexplained weight loss, fatigue, ' +
      'blurred vision. Diagnosis: fasting glucose >=7.0 mmol/L (126 mg/dL) or HbA1c >=48 mmol/mol ' +
      '(6.5%). DKA (Type 1): fruity breath, nausea/vomiting, abdominal pain, Kussmaul breathing, ' +
      'altered consciousness — emergency. HHS (Type 2): severe hyperglycemia without ketosis, ' +
      'profound dehydration, altered consciousness. Hypoglycemia (<3.9 mmol/L): shakiness, ' +
      'sweating, confusion, palpitations — treat immediately with 15 g fast-acting carbohydrate.',
  },

  {
    id: 'uti-recognition',
    title: 'Urinary tract infection (UTI) — recognition',
    tags: ['urological', 'infection'],
    body:
      'Lower UTI (cystitis): dysuria, urinary frequency/urgency, suprapubic pain, cloudy or ' +
      'foul-smelling urine, low-grade fever. Upper UTI (pyelonephritis): above plus high fever ' +
      '>38.5°C, rigors, loin/flank pain, nausea/vomiting, costovertebral angle tenderness. ' +
      'Risk factors: female sex, sexual activity, urinary catheter, urological anomaly, pregnancy, ' +
      'diabetes. Complicated UTI: male, pregnancy, children, catheter-associated, structural ' +
      'abnormality, hospital-acquired — requires longer treatment and urine culture guidance.',
  },

  {
    id: 'appendicitis-recognition',
    title: 'Acute appendicitis — clinical recognition',
    tags: ['gi', 'emergency', 'surgical'],
    body:
      'Classic: periumbilical pain migrating to right iliac fossa (McBurney\'s point) over 12-24h, ' +
      'anorexia, nausea, low-grade fever. Signs: RIF tenderness, guarding, Rovsing\'s sign ' +
      '(RIF pain on LIF pressure), rebound tenderness. Atypical in children, elderly, pregnant ' +
      '(appendix displaced superiorly). Alvarado score >=7 suggests appendicitis. ' +
      'Perforation risk increases after 24-36 h — peritonitis presents as generalized rigid abdomen, ' +
      'high fever, tachycardia. Do not give laxatives or enemas. Nil by mouth and urgent surgical referral.',
  },

  {
    id: 'renal-colic',
    title: 'Renal colic (kidney stones)',
    tags: ['urological', 'pain'],
    body:
      'Severe, sudden-onset loin-to-groin colicky pain, often unilateral, patient cannot stay still. ' +
      'Associated with nausea, vomiting, hematuria (visible or microscopic). Pain typically follows ' +
      'ureteral path: flank → ipsilateral lower quadrant → groin/testis or labia. Ultrasound or ' +
      'non-contrast CT KUB confirms. Most stones <5 mm pass spontaneously. Indications for urgent ' +
      'intervention: obstructed infected kidney (fever + obstruction = emergency — sepsis risk), ' +
      'single functioning kidney, bilateral obstruction, intractable pain/vomiting, stone >10 mm.',
  },

  {
    id: 'migraine-recognition',
    title: 'Migraine vs tension-type headache',
    tags: ['neuro', 'pain'],
    body:
      'Migraine: unilateral pulsating moderate-severe headache 4-72h, worsened by routine activity, ' +
      'with nausea/vomiting and/or photophobia + phonophobia. Aura (1/3 of patients): reversible ' +
      'visual (zigzag), sensory, or speech symptoms before headache, lasting 5-60 min. ' +
      'Tension-type: bilateral pressing/tightening, mild-moderate, not aggravated by activity, no ' +
      'nausea, may have only one of photo/phonophobia. Treatment: NSAIDs or paracetamol for mild; ' +
      'triptans for moderate-severe migraine. Red flags for secondary headache: thunderclap onset, ' +
      'fever, meningism, neurological deficit, positional component.',
  },

  {
    id: 'gastroenteritis-foodpoisoning',
    title: 'Acute gastroenteritis and food poisoning',
    tags: ['gi', 'infection'],
    body:
      'Symptoms: nausea, vomiting, diarrhea, abdominal cramps, low-grade fever. Food poisoning ' +
      'onset 1-6h (Staph toxin) or 8-16h (C. perfringens) or 12-48h (Salmonella, Campylobacter, ' +
      'norovirus). Viral gastroenteritis: norovirus peaks in winter, vomiting prominent, 24-48h. ' +
      'Management: oral rehydration, avoid anti-diarrheals in febrile or bloody diarrhea. ' +
      'Alarm features requiring investigation: blood in stool, fever >38.5°C, >6 stools/day, ' +
      'immunocompromised patient, duration >7 days, recent antibiotic use (C. diff risk), ' +
      'significant dehydration (dry mouth, decreased urine, dizziness on standing).',
  },

  {
    id: 'allergic-rhinitis',
    title: 'Allergic rhinitis and hay fever',
    tags: ['allergy', 'respiratory'],
    body:
      'Symptoms: sneezing (often paroxysmal), nasal itch, watery rhinorrhea, nasal congestion, ' +
      'itchy/red/watery eyes (allergic conjunctivitis). Seasonal (pollen) vs perennial (house dust ' +
      'mite, pet dander, mould). Diagnosis clinical; skin prick test or specific IgE confirms ' +
      'trigger. First-line: intranasal corticosteroids (most effective). Second-generation ' +
      'antihistamines for mild-intermittent. Avoid decongestants >3-5 days (rebound congestion). ' +
      'Distinguish from sinusitis (facial pain/pressure, purulent discharge, reduced smell, ' +
      'toothache) which may need antibiotics if persistent >10 days.',
  },

  {
    id: 'low-back-pain-red-flags',
    title: 'Low back pain — red flags for serious pathology',
    tags: ['musculoskeletal', 'neuro'],
    body:
      'Most low back pain (>90%) is non-specific and self-limiting. Red flags requiring urgent ' +
      'imaging/referral: age <18 or new onset >50 with no prior back pain, history of malignancy, ' +
      'unexplained weight loss, immunosuppression/HIV, IVDU, prolonged corticosteroid use, ' +
      'significant morning stiffness (ankylosing spondylitis), trauma, night pain that awakens ' +
      'from sleep, fever, bladder/bowel dysfunction, saddle anesthesia, bilateral leg weakness ' +
      '(cauda equina emergency — requires same-day MRI). Sciatica: radiating leg pain below knee ' +
      'following dermatomal pattern, positive straight leg raise.',
  },

  {
    id: 'dvt-pe',
    title: 'Deep vein thrombosis (DVT) and pulmonary embolism (PE)',
    tags: ['vascular', 'emergency'],
    body:
      'DVT: unilateral leg swelling, pain, warmth, erythema, pitting edema — most often in calf or ' +
      'thigh. Wells DVT score >=2 = high probability — get compression ultrasound. PE: sudden ' +
      'dyspnea, pleuritic chest pain, tachycardia, hemoptysis, syncope. Wells PE score >4 = high ' +
      'probability — get CTPA. Risk factors: immobility, recent surgery, malignancy, pregnancy, ' +
      'OCP, prior VTE, thrombophilia. Massive PE with hemodynamic compromise = emergency ' +
      'thrombolysis. High-risk PE: O2, IV access, anticoagulation, urgent cardiology.',
  },

  {
    id: 'wound-infection',
    title: 'Wound infection — recognition and management',
    tags: ['infection', 'surgical', 'skin'],
    body:
      'Signs of surgical site or traumatic wound infection: increasing pain (rather than ' +
      'improving), erythema extending beyond wound edges, warmth, swelling, purulent discharge, ' +
      'fever, lymphangitis (red streaks tracking proximally). Superficial: wound care, remove ' +
      'sutures if needed, drainage. Consider antibiotics for spreading cellulitis. Necrotizing ' +
      'fasciitis: disproportionate pain, rapid spread, skin discoloration (dusky/grey), crepitus, ' +
      'systemic toxicity — emergency surgical debridement required. ' +
      'Tetanus prophylaxis based on wound type and immunization status.',
  },

  {
    id: 'chest-pain-differential',
    title: 'Chest pain — differential and approach',
    tags: ['cardiac', 'respiratory', 'emergency'],
    body:
      'Life-threatening causes to exclude first: ACS (pressure, radiation, diaphoresis), ' +
      'aortic dissection (tearing, maximal at onset, unequal BPs), PE (dyspnea, pleuritic, ' +
      'tachycardia, risk factors), tension pneumothorax (sudden, tracheal deviation, absent breath ' +
      'sounds, hemodynamic compromise). Other causes: pericarditis (sharp, worse lying flat, ' +
      'improved leaning forward, friction rub), pleuritis, esophageal spasm (mimics ACS, relieved ' +
      'by antacids), musculoskeletal (reproduced by palpation or movement), GERD. ' +
      'ECG within 10 minutes for any cardiac suspicion.',
  },

  {
    id: 'fever-approach',
    title: 'Fever — systematic approach',
    tags: ['infection', 'fever', 'emergency'],
    body:
      'Fever defined as temperature >38.0°C. Assess: height and duration, rigors (bacteremia), ' +
      'localizing symptoms (cough, dysuria, rash, diarrhea, headache, neck stiffness). ' +
      'Danger signs requiring urgent assessment: temperature >40°C or <36°C (sepsis), ' +
      'altered mental status, severe headache with photophobia/neck stiffness (meningitis), ' +
      'petechial/purpuric non-blanching rash (meningococcemia), hypotension or tachycardia, ' +
      'returning traveler from malaria-endemic area, neutropenic patient (chemotherapy). ' +
      'Paracetamol 1 g q6h or ibuprofen 400 mg q8h for symptomatic relief.',
  },

  {
    id: 'skin-rash-approach',
    title: 'Skin rash — clinical approach',
    tags: ['skin', 'infection', 'allergy'],
    body:
      'Characterize: distribution (localized vs generalized), morphology (macule, papule, vesicle, ' +
      'pustule, urticaria, purpura), timing (acute vs chronic), associated symptoms. ' +
      'Urgent/dangerous rashes: non-blanching purpura/petechiae (meningococcemia, vasculitis — ' +
      'emergency), Stevens-Johnson syndrome (mucous membrane involvement, skin detachment), ' +
      'angioedema with airway compromise. Viral exanthems (measles, rubella, roseola, ' +
      'chickenpox): usually self-limiting, distinct patterns. Contact dermatitis: pruritic, ' +
      'localized to exposure site. Drug reactions: onset 7-14 days after starting new medication.',
  },
];
