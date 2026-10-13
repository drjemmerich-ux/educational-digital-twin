// HIDDEN frozen case content for EDT-LUM-DUMMY-001 (handoff 1.0, 12 October 2026).
// Source: EDT_Lumbar_Functional_Prototype_Master_Prompt_v1.0.md sections 5-11, supplemented by
// Biblia_Visual_Caso_Lumbar_v0.1.json (29 September 2026). Only src/engine/commands.ts may import
// this module. Selectors, UI, tutor and replay must use released event payloads instead.
import type {
  BranchId,
  BranchOptionId,
  BranchStep,
  ClinicalUpdate,
  FollowUpContent,
  InvestigationResult,
  OperativeContent,
  PresentationSnapshot,
  SimTime,
} from './types.ts';

export const SIM = {
  T0: { code: 'T0', label: 'Case entry (T0)' },
  T7: { code: 'T+7d', label: 'Day 7 after case entry' },
  T10: { code: 'T+10d', label: 'Day 10 after case entry' },
  T12: { code: 'T+12d', label: 'Day 12 after case entry' },
  T14: { code: 'T+14d', label: 'Day 14 after case entry' },
  POD0: { code: 'POD0', label: 'Operative day (day 28 after case entry)' },
  POD1: { code: 'POD1', label: 'Postoperative day 1' },
  POD3: { code: 'POD3', label: 'Postoperative day 3' },
  POD4: { code: 'POD4', label: 'Postoperative day 4' },
  POD7: { code: 'POD7', label: 'Postoperative day 7' },
  W6: { code: 'W6', label: 'Six weeks after surgery' },
  HIST_6M: { code: 'T-6m', label: 'Approximately six months before case entry' },
  B2_REASSESS: { code: 'POD4+obs', label: 'After the monitored observation period (interval not specified in the case)' },
  B2_RESOLVED: { code: 'B2-resolved', label: 'After the prescribed drainage period (interval not specified in the case)' },
  B3_REASSESS: { code: 'POD4+reop', label: 'After re-exploration (interval not specified in the case)' },
  B4_REASSESS: { code: 'POD4+defer', label: 'At reassessment after deferral (interval not specified in the case)' },
  RESCUE_RESOLVED: { code: 'rescue-resolved', label: 'After the second treatment (interval not specified in the case)' },
} satisfies Record<string, SimTime>;

export const PRESENTATION: PresentationSnapshot = {
  patient: {
    displayName: 'Elena Marsh',
    ageYears: 64,
    sex: 'Female',
    occupation: 'Architect, professionally active part-time',
    activity: 'Independent and active; values walking, travel, and continued professional engagement',
    heightCm: 164,
    weightKg: 72,
    bmi: 26.8,
    portraitAssetId: 'CLIN-N1-001',
  },
  history: {
    chiefConcern:
      'Progressive bilateral leg pain with walking, right greater than left. Leg symptoms limit her function more than her low-back pain.',
    duration: '14 months, progressive',
    walkingTolerance: 'Approximately 180 m',
    aggravating: ['Standing', 'Lumbar extension', 'Walking for more than 5 to 7 minutes'],
    relieving: ['Sitting', 'Forward trunk flexion', 'Leaning on a shopping cart'],
    priorManagement: [
      { when: 'Since symptom onset', what: 'Anti-inflammatory medication and simple analgesics with partial benefit' },
      { when: 'About 9 months before entry', what: 'Twelve weeks of supervised physical therapy and exercise' },
      { when: 'About 6 months before entry', what: 'Technically adequate right L5 selective nerve-root block with substantial but temporary relief of leg pain' },
      { when: 'Ongoing', what: 'Activity modification without restoration of walking tolerance' },
    ],
    preference:
      'She prefers a durable improvement but is concerned about an extensive operation and wants to understand reasonable alternatives.',
    redFlagsAbsent: [
      'Bladder or bowel dysfunction',
      'Saddle anesthesia',
      'Fever',
      'Weight loss',
      'Nonmechanical night pain',
      'Active cancer history',
    ],
  },
  examination: [
    { domain: 'Gait', finding: 'Independent, with mild difficulty during right heel walking' },
    { domain: 'Hip flexion', finding: '5/5 bilaterally' },
    { domain: 'Knee extension', finding: '5/5 bilaterally' },
    { domain: 'Ankle dorsiflexion', finding: '5/5 bilaterally' },
    { domain: 'Extensor hallucis longus', finding: '4+/5 right, 5/5 left' },
    { domain: 'Plantar flexion', finding: '5/5 bilaterally' },
    { domain: 'Sensation', finding: 'Mild intermittent hypoesthesia over the dorsum of the right foot' },
    { domain: 'Patellar reflexes', finding: '2+ and symmetric' },
    { domain: 'Achilles reflexes', finding: '1+ and symmetric' },
    { domain: 'Straight-leg raise', finding: 'Negative bilaterally' },
    { domain: 'Distal pulses', finding: 'Present and symmetric' },
    { domain: 'Upper motor neuron signs', finding: 'Absent' },
  ],
  baselineMeasures: [
    { label: 'Oswestry Disability Index (ODI)', value: '42%' },
    { label: 'Back pain', value: '6/10' },
    { label: 'Right leg pain', value: '8/10' },
    { label: 'Left leg pain', value: '5/10' },
    { label: 'Walking tolerance', value: 'Approximately 180 m' },
    {
      label: "Patient's reported confidence in current management",
      value: '35/100',
      note: "This is the patient's own rating. It is separate from your confidence in a hypothesis or plan.",
    },
  ],
};

const NO_ANNOTATION: string[] = [];

export const RESULTS: Record<string, InvestigationResult> = {
  lumbar_mri: {
    investigationId: 'lumbar_mri',
    acquiredAt: SIM.T10,
    series: [
      { assetId: 'MRI-N2-001', title: 'Sagittal T1', plane: 'Sagittal', sequence: 'T1', plannedFrameCount: 14 },
      { assetId: 'MRI-N2-002', title: 'Sagittal T2', plane: 'Sagittal', sequence: 'T2', plannedFrameCount: 16 },
      { assetId: 'MRI-N2-003', title: 'Axial T2, L3-L4', plane: 'Axial', sequence: 'T2', plannedFrameCount: 14 },
      { assetId: 'MRI-N2-004', title: 'Axial T2, L4-L5', plane: 'Axial', sequence: 'T2', plannedFrameCount: 18 },
      { assetId: 'MRI-N2-005', title: 'Axial T2, L5-S1', plane: 'Axial', sequence: 'T2', plannedFrameCount: 14 },
    ],
    reportAssetId: null,
    reportTitle: 'Lumbar MRI report',
    sections: [
      { heading: 'Technique', lines: ['Supine MRI of the lumbar spine: sagittal T1 and T2; axial T2 at L3-L4, L4-L5, and L5-S1.'] },
      {
        heading: 'Findings',
        lines: [
          'L4-L5: grade I degenerative spondylolisthesis. Translation measures approximately 2.5 mm on this supine study.',
          'L4-L5: a broad disc bulge, advanced facet hypertrophy, and ligamentum flavum thickening produce severe central and bilateral lateral-recess stenosis, right greater than left.',
          'L4-L5: dural sac cross-sectional area approximately 58 mm².',
          'L4-L5 facet joint effusions: right approximately 2.5 mm, left approximately 1.8 mm.',
          'No synovial cyst. No dominant foraminal stenosis.',
          'L3-L4: mild degeneration without clinically significant stenosis.',
          'L5-S1: mild degeneration without clinically relevant stenosis.',
          'No tumor, infection, or fracture.',
        ],
      },
      {
        heading: 'Impression',
        lines: [
          'Severe multifactorial L4-L5 central and bilateral lateral-recess stenosis, right greater than left, with grade I degenerative spondylolisthesis (approximately 2.5 mm on supine imaging).',
          'Mild, non-dominant degeneration at L3-L4 and L5-S1.',
        ],
      },
    ],
    accessibleSummary:
      'Supine lumbar MRI: severe L4-L5 central and bilateral lateral-recess stenosis, right greater than left; grade I spondylolisthesis measuring about 2.5 mm supine; dural sac area about 58 mm²; facet effusions 2.5 mm right and 1.8 mm left; mild degeneration at L3-L4 and L5-S1.',
    annotationAssetIds: ['PLAN-N3-002'],
  },
  standing_lumbar_xr: {
    investigationId: 'standing_lumbar_xr',
    acquiredAt: SIM.T7,
    series: [
      { assetId: 'XR-N2-001', title: 'Standing lumbar AP', plane: 'Coronal projection', sequence: null, plannedFrameCount: 1 },
      { assetId: 'XR-N2-002', title: 'Standing lumbar lateral', plane: 'Lateral projection', sequence: null, plannedFrameCount: 1 },
    ],
    reportAssetId: null,
    reportTitle: 'Standing lumbar radiograph report',
    sections: [
      { heading: 'AP view', lines: ['Coronal balance is preserved. Mild degenerative change. No destructive lesion.'] },
      {
        heading: 'Lateral view',
        lines: [
          'Grade I degenerative spondylolisthesis at L4-L5 with translation of approximately 4.5 mm on standing.',
          'L4-L5 disc height is partially preserved. Facet degeneration.',
          'No fracture.',
        ],
      },
    ],
    accessibleSummary:
      'Standing lumbar radiographs: preserved coronal balance; grade I L4-L5 spondylolisthesis with about 4.5 mm standing translation; partially preserved disc height; facet degeneration.',
    annotationAssetIds: NO_ANNOTATION,
  },
  dynamic_xr: {
    investigationId: 'dynamic_xr',
    acquiredAt: SIM.T7,
    series: [
      { assetId: 'XR-N2-003', title: 'Lateral flexion', plane: 'Lateral projection', sequence: null, plannedFrameCount: 1 },
      { assetId: 'XR-N2-004', title: 'Lateral extension', plane: 'Lateral projection', sequence: null, plannedFrameCount: 1 },
    ],
    reportAssetId: null,
    reportTitle: 'Flexion and extension radiograph report',
    sections: [
      {
        heading: 'Findings',
        lines: [
          'L4-L5 translation: approximately 6.0 mm in flexion.',
          'L4-L5 translation: approximately 3.0 mm in extension.',
          'L4-L5 angular change across flexion and extension: approximately 8 degrees.',
        ],
      },
    ],
    accessibleSummary:
      'Dynamic radiographs: L4-L5 translation about 6.0 mm in flexion and 3.0 mm in extension; angular change about 8 degrees.',
    annotationAssetIds: ['PLAN-N3-003'],
  },
  full_spine_xr: {
    investigationId: 'full_spine_xr',
    acquiredAt: SIM.T7,
    series: [
      { assetId: 'EOS-N2-001', title: 'Standing full-spine AP', plane: 'Coronal projection', sequence: null, plannedFrameCount: 1 },
      { assetId: 'EOS-N2-002', title: 'Standing full-spine lateral', plane: 'Lateral projection', sequence: null, plannedFrameCount: 1 },
    ],
    reportAssetId: null,
    reportTitle: 'Full-spine radiograph report',
    sections: [
      { heading: 'AP view', lines: ['Lumbar Cobb angle approximately 7 degrees. No significant coronal imbalance.'] },
      {
        heading: 'Lateral view',
        lines: [
          'Pelvic incidence 55 degrees. Lumbar lordosis 49 degrees. Pelvic tilt 21 degrees.',
          'Sagittal vertical axis +30 mm.',
        ],
      },
      { heading: 'Impression', lines: ['Mild compensated spinopelvic malalignment.'] },
    ],
    accessibleSummary:
      'Full-spine radiographs: lumbar Cobb about 7 degrees without significant coronal imbalance; PI 55, LL 49, PT 21 degrees; SVA +30 mm.',
    annotationAssetIds: NO_ANNOTATION,
  },
  lumbar_ct: {
    investigationId: 'lumbar_ct',
    acquiredAt: SIM.T12,
    series: [
      { assetId: 'CT-N2-001', title: 'Sagittal bone window', plane: 'Sagittal', sequence: 'Bone window', plannedFrameCount: 16 },
      { assetId: 'CT-N2-002', title: 'Axial L4-L5 bone window', plane: 'Axial', sequence: 'Bone window', plannedFrameCount: 18 },
      { assetId: 'CT-N2-003', title: 'Coronal bone window', plane: 'Coronal', sequence: 'Bone window', plannedFrameCount: 16 },
    ],
    reportAssetId: null,
    reportTitle: 'Lumbar CT report',
    sections: [
      {
        heading: 'Findings',
        lines: [
          'Grade I degenerative spondylolisthesis at L4-L5.',
          'Mild disc-space narrowing at L4-L5 with advanced bilateral facet arthrosis, without vacuum phenomenon.',
          'No pars defect. No fracture or lytic lesion.',
          'Pedicles are symmetric. No segmentation anomaly.',
          'Mean attenuation at L1 approximately 118 HU.',
        ],
      },
    ],
    accessibleSummary:
      'Lumbar CT: grade I L4-L5 spondylolisthesis; mild L4-L5 disc-space narrowing with advanced bilateral facet arthrosis, without vacuum phenomenon; no pars defect or fracture; L1 attenuation about 118 HU.',
    annotationAssetIds: NO_ANNOTATION,
  },
  emg_ncs: {
    investigationId: 'emg_ncs',
    acquiredAt: SIM.T12,
    series: [],
    reportAssetId: 'EMG-N2-001',
    reportTitle: 'EMG and nerve conduction report',
    sections: [
      {
        heading: 'Conclusion',
        lines: [
          'Findings consistent with a mild chronic right L5 radiculopathy.',
          'No evidence of active denervation.',
          'No electrophysiological evidence of polyneuropathy.',
        ],
      },
    ],
    accessibleSummary: 'Mild chronic right L5 radiculopathy without active denervation; no polyneuropathy.',
    annotationAssetIds: NO_ANNOTATION,
  },
  preop_labs: {
    investigationId: 'preop_labs',
    acquiredAt: SIM.T12,
    series: [],
    reportAssetId: 'LAB-N2-001',
    reportTitle: 'Routine laboratory panel',
    sections: [
      {
        heading: 'Results',
        lines: [
          'Complete blood count: within normal limits.',
          'Renal function: within normal limits.',
          'Coagulation profile: within normal limits.',
          'Inflammatory markers: within normal limits.',
        ],
      },
      { heading: 'Note', lines: ['Individual numeric values are not specified in this synthetic case record.'] },
    ],
    accessibleSummary: 'CBC, renal function, coagulation profile, and inflammatory markers within normal limits.',
    annotationAssetIds: NO_ANNOTATION,
  },
  dxa: {
    investigationId: 'dxa',
    acquiredAt: SIM.T12,
    series: [],
    reportAssetId: 'DXA-N2-001',
    reportTitle: 'DXA report',
    sections: [
      { heading: 'Results', lines: ['Femoral-neck T-score -1.4.'] },
      { heading: 'Conclusion', lines: ['Consistent with mild osteopenia, without osteoporosis.'] },
    ],
    accessibleSummary: 'Femoral-neck T-score -1.4: mild osteopenia without osteoporosis.',
    annotationAssetIds: NO_ANNOTATION,
  },
  prior_block_record: {
    investigationId: 'prior_block_record',
    acquiredAt: SIM.HIST_6M,
    series: [],
    reportAssetId: 'INJ-N2-001',
    reportTitle: 'Right L5 selective nerve-root block record',
    sections: [
      { heading: 'Procedure', lines: ['Right L5 selective nerve-root block, approximately six months before case entry. Technically adequate.'] },
      { heading: 'Response', lines: ['Substantial but temporary relief of right leg pain.', 'No meaningful change in back pain.'] },
      { heading: 'Note', lines: ['Technique, medication, and the duration of relief are not specified in this synthetic case record.'] },
    ],
    accessibleSummary: 'Technically adequate right L5 block with substantial but temporary right leg-pain relief and no meaningful change in back pain.',
    annotationAssetIds: NO_ANNOTATION,
  },
  postop_mri: {
    investigationId: 'postop_mri',
    acquiredAt: SIM.POD4,
    series: [
      { assetId: 'MRI-N4-001', title: 'Sagittal T2', plane: 'Sagittal', sequence: 'T2', plannedFrameCount: 18 },
      { assetId: 'MRI-N4-002', title: 'Axial T2, L4-L5', plane: 'Axial', sequence: 'T2', plannedFrameCount: 18 },
      { assetId: 'MRI-N4-003', title: 'Coronal T2', plane: 'Coronal', sequence: 'T2', plannedFrameCount: 14 },
    ],
    reportAssetId: null,
    reportTitle: 'Postoperative lumbar MRI report',
    sections: [
      { heading: 'Technique', lines: ['Lumbar MRI: sagittal T2, axial T2 at L4-L5, and coronal T2.'] },
      {
        heading: 'Findings',
        lines: [
          'Postoperative changes of decompression at L4-L5.',
          'A dorsal epidural and subfascial collection of CSF signal intensity on T2-weighted images communicates with the decompression bed.',
          'The collection measures approximately 48 mm transverse × 18 mm anteroposterior × 55 mm craniocaudal.',
          'Mild mass effect without severe neural compression.',
          'No compressive hematoma. No abscess pattern. No severe cauda equina compression.',
        ],
      },
      { heading: 'Impression', lines: ['Communicating postoperative pseudomeningocele without severe neural compression, hematoma, or abscess pattern.'] },
    ],
    accessibleSummary:
      'Postoperative MRI: communicating CSF-intensity dorsal epidural and subfascial collection about 48 mm transverse × 18 mm anteroposterior × 55 mm craniocaudal with mild mass effect; no severe compression, hematoma, or abscess pattern.',
    annotationAssetIds: NO_ANNOTATION,
  },
  postop_labs: {
    investigationId: 'postop_labs',
    acquiredAt: SIM.POD3,
    series: [],
    reportAssetId: 'LAB-N4-001',
    reportTitle: 'Postoperative laboratory trend (routine since postoperative day 1)',
    sections: [
      { heading: 'Trend', lines: ['Mild postoperative leukocytosis, trending downward since postoperative day 1.', 'No laboratory pattern of infection.'] },
      { heading: 'Note', lines: ['Individual numeric values are not specified in this synthetic case record.'] },
    ],
    accessibleSummary: 'Expected mild postoperative leukocytosis trending downward; no laboratory pattern of infection.',
    annotationAssetIds: NO_ANNOTATION,
  },
  postop_ct: {
    investigationId: 'postop_ct',
    acquiredAt: SIM.POD3,
    series: [
      { assetId: 'CT-N4-001', title: 'Sagittal bone window', plane: 'Sagittal', sequence: 'Bone window', plannedFrameCount: 12 },
      { assetId: 'CT-N4-002', title: 'Axial L4-L5 bone window', plane: 'Axial', sequence: 'Bone window', plannedFrameCount: 16 },
    ],
    reportAssetId: null,
    reportTitle: 'Postoperative lumbar CT report',
    sections: [
      {
        heading: 'Findings',
        lines: [
          'Postoperative changes of L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension toward L3-L4.',
          'Facets are preserved. No fracture.',
          'No fusion and no instrumentation.',
        ],
      },
    ],
    accessibleSummary: 'Postoperative CT: L4-L5 decompression with limited cranial extension, preserved facets, no fracture, no fusion or instrumentation.',
    annotationAssetIds: NO_ANNOTATION,
  },
  followup_xr: {
    investigationId: 'followup_xr',
    acquiredAt: SIM.W6,
    series: [
      { assetId: 'XR-N5-001', title: 'Standing lumbar AP', plane: 'Coronal projection', sequence: null, plannedFrameCount: 1 },
      { assetId: 'XR-N5-002', title: 'Standing lumbar lateral', plane: 'Lateral projection', sequence: null, plannedFrameCount: 1 },
    ],
    reportAssetId: null,
    reportTitle: 'Six-week standing lumbar radiograph report',
    sections: [
      { heading: 'AP view', lines: ['Postoperative decompression changes. No new coronal deformity. No hardware.'] },
      { heading: 'Lateral view', lines: ['Persistent grade I L4-L5 slip without clear early progression. No instrumentation.'] },
    ],
    accessibleSummary: 'Six-week radiographs: persistent grade I L4-L5 slip without clear early progression; no instrumentation.',
    annotationAssetIds: NO_ANNOTATION,
  },
};

export const OPERATIVE: OperativeContent = {
  procedureTime: SIM.POD0,
  procedureDescription: [
    'Predefined demonstration procedure: complete L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension into L3-L4.',
    'No fusion and no instrumentation are performed.',
  ],
  checkpoint: {
    id: 'intraop_checkpoint',
    time: SIM.POD0,
    title: 'Intraoperative checkpoint',
    lines: [
      'During decompression of the right lateral recess, the team recognizes a dural defect of approximately 4 mm.',
      'Cerebrospinal fluid is visible at the defect.',
    ],
    images: [{ assetId: 'OR-N4-002', title: 'Operative field at the checkpoint', caption: 'Synthetic operative illustration pending production.' }],
  },
  teamAction: [
    'The simulated team performs a primary suture repair with adjunctive sealant.',
    'A Valsalva test at closure is negative.',
  ],
  operativeReport: {
    title: 'Operative report',
    sections: [
      { heading: 'Procedure', lines: ['Complete L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension into L3-L4. No fusion or instrumentation.'] },
      { heading: 'Intraoperative event', lines: ['Recognized dural defect of approximately 4 mm in the right lateral recess.'] },
      { heading: 'Management', lines: ['Primary suture repair with adjunctive sealant. Negative Valsalva test at closure.'] },
    ],
  },
};

export const CLINICAL_UPDATES: Record<'pod1' | 'pod3', ClinicalUpdate> = {
  pod1: {
    id: 'pod1',
    time: SIM.POD1,
    title: 'Postoperative day 1',
    lines: ['Leg pain has improved.', 'Mobilization has begun.'],
    notes: [{ time: 'POD1', author: 'Nursing', text: 'Leg pain improved compared with before surgery. Mobilizing.' }],
  },
  pod3: {
    id: 'pod3',
    time: SIM.POD3,
    title: 'New postoperative findings',
    lines: [
      'Headache that is worse when upright (orthostatic).',
      'Clear fluid draining from the wound.',
      'No fever.',
      'No new neurologic deficit.',
    ],
    notes: [{ time: 'POD3', author: 'Nursing', text: 'Postural headache reported. Increased clear drainage on the dressing with mobilization.' }],
    images: [
      { assetId: 'CLIN-N4-001', title: 'Wound dressing photograph', caption: 'Small clear serous stain without marked erythema, purulence, or dehiscence.' },
    ],
  },
};

export const BRANCH_MAP: Record<Exclude<BranchOptionId, 'opt_none'>, BranchId> = {
  opt_drain: 'B1',
  opt_observe: 'B2',
  opt_reexplore: 'B3',
  opt_defer: 'B4',
};

export const BRANCH_STEPS: Record<string, BranchStep> = {
  B1_start: {
    id: 'B1_start',
    time: SIM.POD4,
    title: 'Lumbar CSF drainage',
    lines: ['Lumbar CSF drainage has started. It will be maintained for 72 hours according to the prescribed course.'],
    notes: [{ time: 'POD4', author: 'Nursing', text: 'Lumbar drainage started.' }],
  },
  B1_resolved: {
    id: 'B1_resolved',
    time: SIM.POD7,
    title: 'After 72 hours of lumbar drainage',
    lines: [
      'Headache and wound drainage have resolved.',
      'The drain was removed on postoperative day 7 after symptom and wound-dryness criteria were met.',
      'No re-exploration was performed.',
    ],
    notes: [{ time: 'POD7', author: 'Nursing', text: 'No headache. Wound dry. Drain removed.' }],
  },
  B2_start: {
    id: 'B2_start',
    time: SIM.POD4,
    title: 'Monitored recumbency and wound observation',
    lines: ['A short monitored period of recumbency and wound observation has begun.'],
  },
  B2_persistence: {
    id: 'B2_persistence',
    time: SIM.B2_REASSESS,
    title: 'Reassessment after the monitored period',
    lines: ['Headache and clear wound drainage persist.', 'A further management decision is required.'],
    notes: [{ time: 'Reassessment', author: 'Nursing', text: 'Postural headache persists. Clear drainage continues.' }],
  },
  B2_rescue_start: {
    id: 'B2_rescue_start',
    time: SIM.B2_REASSESS,
    title: 'Lumbar CSF drainage',
    lines: ['Lumbar CSF drainage has started according to the prescribed course.'],
  },
  B2_resolved: {
    id: 'B2_resolved',
    time: SIM.B2_RESOLVED,
    title: 'After the prescribed drainage period',
    lines: ['The leak has resolved.', 'The hospital stay was modestly prolonged.'],
  },
  B3_start: {
    id: 'B3_start',
    time: SIM.POD4,
    title: 'Operative re-exploration',
    lines: ['Early operative re-exploration and reinforced repair are performed.'],
  },
  B3_resolved: {
    id: 'B3_resolved',
    time: SIM.B3_REASSESS,
    title: 'Reassessment after re-exploration',
    lines: ['The leak has resolved.', 'This course included an additional operation and its associated burden.'],
  },
  B4_start: {
    id: 'B4_start',
    time: SIM.POD4,
    title: 'Targeted treatment deferred',
    lines: ['Targeted treatment is deferred. Wound drainage continues.'],
  },
  B4_persistence: {
    id: 'B4_persistence',
    time: SIM.B4_REASSESS,
    title: 'Reassessment',
    lines: ['The collection and symptoms persist.', 'A further management decision is required.'],
  },
  // Continuations authored by Dr Emmerich on 12 October 2026 (decision 5). Qualitative only.
  B2_reexplore_start: {
    id: 'B2_reexplore_start',
    time: SIM.B2_REASSESS,
    title: 'Operative re-exploration',
    lines: ['Operative re-exploration and reinforced repair are performed.'],
  },
  B2_reexplore_resolved: {
    id: 'B2_reexplore_resolved',
    time: SIM.RESCUE_RESOLVED,
    title: 'Reassessment after re-exploration',
    lines: ['The leak has resolved.', 'This course included an additional operation and a longer hospital stay.'],
  },
  B4_drain_start: {
    id: 'B4_drain_start',
    time: SIM.B4_REASSESS,
    title: 'Lumbar CSF drainage',
    lines: ['Lumbar CSF drainage has started according to the prescribed course.'],
  },
  B4_drain_resolved: {
    id: 'B4_drain_resolved',
    time: SIM.RESCUE_RESOLVED,
    title: 'After the prescribed drainage period',
    lines: ['The leak has resolved.', 'The hospital stay was prolonged.'],
  },
  B4_reexplore_start: {
    id: 'B4_reexplore_start',
    time: SIM.B4_REASSESS,
    title: 'Operative re-exploration',
    lines: ['Operative re-exploration and reinforced repair are performed.'],
  },
  B4_reexplore_resolved: {
    id: 'B4_reexplore_resolved',
    time: SIM.RESCUE_RESOLVED,
    title: 'Reassessment after re-exploration',
    lines: ['The leak has resolved.', 'This course included an additional operation and a longer hospital stay.'],
  },
};

export type CourseId = 'B1' | 'B2' | 'B3' | 'B2_reexplore' | 'B4_drain' | 'B4_reexplore';

const NO_MEASURES = ['Detailed six-week clinical measures are not authored for this course.'];

export const FOLLOW_UP: Record<CourseId, FollowUpContent> = {
  B1: {
    time: SIM.W6,
    title: 'Six-week follow-up',
    measures: [
      { label: 'Walking tolerance', baseline: 'Approximately 180 m', followUp: '900 m' },
      { label: 'Back pain', baseline: '6/10', followUp: '3/10' },
      { label: 'Right leg pain', baseline: '8/10', followUp: '2/10' },
      { label: 'Left leg pain', baseline: '5/10', followUp: 'Not recorded in this case' },
      { label: 'ODI', baseline: '42%', followUp: '24%' },
      { label: 'Right EHL strength', baseline: '4+/5', followUp: '5/5' },
    ],
    lines: ['CSF leak: resolved.', 'Wound: healed, without drainage.', 'Headache: no recurrence.'],
    unavailable: [
      'Repeat translation measurement, time to return to work, and long-term stability are not specified in this case.',
    ],
  },
  B2: {
    time: SIM.W6,
    title: 'Follow-up for this course',
    measures: [],
    lines: ['The leak resolved after lumbar drainage.', 'The hospital stay was modestly prolonged.'],
    unavailable: ['Detailed six-week clinical measures are not authored for this course.'],
  },
  B3: {
    time: SIM.W6,
    title: 'Follow-up for this course',
    measures: [],
    lines: ['The leak resolved after re-exploration and reinforced repair.', 'The course included the burden of an additional operation.'],
    unavailable: NO_MEASURES,
  },
  B2_reexplore: {
    time: SIM.W6,
    title: 'Follow-up for this course',
    measures: [],
    lines: ['The leak resolved after re-exploration and reinforced repair.', 'The course included the burden of an additional operation and a longer hospital stay.'],
    unavailable: NO_MEASURES,
  },
  B4_drain: {
    time: SIM.W6,
    title: 'Follow-up for this course',
    measures: [],
    lines: ['The leak resolved after lumbar drainage.', 'The hospital stay was prolonged.'],
    unavailable: NO_MEASURES,
  },
  B4_reexplore: {
    time: SIM.W6,
    title: 'Follow-up for this course',
    measures: [],
    lines: ['The leak resolved after re-exploration and reinforced repair.', 'The course included the burden of an additional operation and a longer hospital stay.'],
    unavailable: NO_MEASURES,
  },
};

/** Debrief-only summaries; released after the clinical episode ends or a review pause begins. */
export const BRANCH_SUMMARIES: Record<BranchId, { action: string; consequence: string }> = {
  B1: {
    action: 'Lumbar CSF drainage for 72 hours after assessment and MRI',
    consequence: 'Headache and wound drainage resolve; the drain is removed on postoperative day 7 after symptom and wound-dryness criteria are met; no re-exploration.',
  },
  B2: {
    action: 'Short monitored period of recumbency and wound observation',
    consequence: 'Symptoms and drainage persist and a second decision is required. Subsequent lumbar drainage resolves the leak with a modestly longer stay; re-exploration at that point also resolves it, with an additional operation and a longer stay. Further observation has no authored consequence.',
  },
  B3: {
    action: 'Early operative re-exploration and reinforced repair',
    consequence: 'The leak resolves; the course includes the additional operative burden.',
  },
  B4: {
    action: 'Defer targeted treatment despite continuing drainage',
    consequence: 'The collection and symptoms persist, requiring reassessment. Subsequent lumbar drainage resolves the leak with a longer stay; re-exploration resolves it with an additional operation and a longer stay. Further delay has no authored consequence.',
  },
};

/** Approved by Dr Emmerich on 13 October 2026 (content review pack, section 11). Debrief only. */
export const FACULTY_PERSPECTIVE: { heading: string; intro: string; sections: { title: string; text: string }[] } = {
  heading: 'Faculty perspective',
  intro: 'One experienced view of this case, offered for reflection. It is not an answer key, and thoughtful surgeons may reasonably differ.',
  sections: [
    {
      title: 'The clinical picture',
      text: "Elena's leg-dominant symptoms, provoked by standing and walking and relieved by flexion, describe neurogenic claudication. The subtle right EHL weakness and dorsal-foot sensory change point to the right L5 root. Present pulses and a negative straight-leg raise help keep vascular claudication and a disc herniation lower on the list. Much of the diagnosis is available before any imaging.",
    },
    {
      title: 'Position matters',
      text: 'Translation at L4-L5 was 4.5 mm standing, 6.0 mm in flexion, 3.0 mm in extension, and 2.5 mm on supine MRI. A supine study alone underestimates the slip under load. Facet effusions and the 8-degree angular change raise the question of instability, while the absent vacuum phenomenon and partially preserved disc height point the other way. No single threshold settles it.',
    },
    {
      title: 'Decompression with or without fusion',
      text: 'Reasonable surgeons disagree here, and the published trials have not converged. A useful question is what the decompression itself will do to stability, and how much the remaining motion matters for this patient. Her wish to avoid an extensive operation, her mild osteopenia and her preserved alignment all belong in that conversation. A clearly recorded threshold for later fusion is as important as the initial choice.',
    },
    {
      title: 'Complementary tests',
      text: 'The EMG and the earlier right L5 block are concordant with the clinical and imaging picture, but neither is definitive. They support a decision; they do not make it.',
    },
    {
      title: 'The durotomy',
      text: 'A recognized small defect is best repaired at once, with a watertight closure and a deliberate check before leaving the field. The more useful habit is to plan the postoperative watch at that moment: what you will ask nursing to report, and what would prompt imaging.',
    },
    {
      title: 'Day 3',
      text: 'Orthostatic headache with clear drainage after a known durotomy points strongly to a CSF leak. The task is to confirm it, exclude infection and a compressive collection, and choose a response proportionate to the findings. Observation, lumbar drainage and early re-exploration each have a place. They differ mainly in burden and in how quickly they settle the problem.',
    },
    {
      title: 'Across the case',
      text: 'Notice where your confidence moved, and whether new information or habit moved it. That is the most transferable lesson of a case like this.',
    },
  ],
};

/** Verified 13 October 2026 against PubMed and Crossref records (content review pack, section 13). Debrief only. */
export const READING_LIST: { citation: string; url: string; note: string }[] = [
  {
    citation: 'Weinstein JN, et al. Surgical versus nonsurgical treatment for lumbar degenerative spondylolisthesis. N Engl J Med. 2007;356(22):2257-70.',
    url: 'https://doi.org/10.1056/NEJMoa070302',
    note: 'Compares operative and nonoperative care for degenerative spondylolisthesis with stenosis.',
  },
  {
    citation: 'Ghogawala Z, et al. Laminectomy plus fusion versus laminectomy alone for lumbar spondylolisthesis. N Engl J Med. 2016;374(15):1424-34.',
    url: 'https://doi.org/10.1056/NEJMoa1508788',
    note: 'Randomized comparison of decompression with and without fusion in stable degenerative spondylolisthesis.',
  },
  {
    citation: 'Försth P, et al. A randomized, controlled trial of fusion surgery for lumbar spinal stenosis. N Engl J Med. 2016;374(15):1413-23.',
    url: 'https://doi.org/10.1056/NEJMoa1513721',
    note: 'Published alongside the previous trial; a randomized trial of adding fusion to decompression for lumbar spinal stenosis.',
  },
  {
    citation: 'Austevoll IM, et al. Decompression with or without fusion in degenerative lumbar spondylolisthesis. N Engl J Med. 2021;385(6):526-38.',
    url: 'https://doi.org/10.1056/NEJMoa2100990',
    note: 'A more recent randomized comparison of decompression with and without fusion.',
  },
  {
    citation:
      'Chaput C, et al. The significance of increased fluid signal on magnetic resonance imaging in lumbar facets in relationship to degenerative spondylolisthesis. Spine. 2007;32(17):1883-7.',
    url: 'https://doi.org/10.1097/brs.0b013e318113271a',
    note: 'Examines the relationship between facet fluid signal on MRI and degenerative spondylolisthesis.',
  },
];
