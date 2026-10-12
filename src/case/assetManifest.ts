// Asset manifest: the 43 planned asset packages from Appendix A / Visual Bible v0.1.
// A package may contain many frames. Planned entries are NOT produced images.
// framePaths stays null until an approved file exists; nothing here points to a nonexistent file.
import { CASE_ID } from './versions.ts';

export type ApprovalState = 'Planned' | 'In production' | 'Clinical review' | 'Rejected' | 'Approved';
export type Audience = 'participant' | 'participant_and_facilitator';

export interface AssetManifestEntry {
  asset_id: string;
  case_id: string;
  node: 'N1' | 'N2' | 'N3' | 'N4' | 'N5';
  relative_timing: string;
  modality: string;
  /** Generic, non-revealing title safe to show before interpretation. */
  generic_title: string;
  plane_or_sequence: string | null;
  release_trigger: string;
  report_release_rule: string;
  audience: Audience;
  expected_frame_count: number;
  /** Actual frame paths. null = no file supplied. */
  frame_paths: string[] | null;
  required_findings: string;
  prohibited_findings: string;
  version: string;
  approval_state: ApprovalState;
  source_policy: string;
  reviewers: string[] | null;
  production_batch: 1 | 2 | 3 | 4;
  /** Orientation and pixel spacing are unverified for every entry in this build. */
  spacing_mm: null;
  orientation: 'unverified';
}

const SOURCE = 'Fully synthetic generation without patient-derived reference images';
const IMG_RULE = 'Formal report and validated annotation copy only after independent interpretation is committed';
const DOC_RULE = 'Released after the request gate; interpretation captured afterwards';
const UI_RULE = 'Displayed as part of the released clinical record';
const DEBRIEF_RULE = 'Debrief only, after the clinical episode ends or a review pause begins';

type Row = [string, AssetManifestEntry['node'], string, string, string, string | null, string, string, Audience, number, string, string, 1 | 2 | 3 | 4];

// [id, node, timing, modality, generic title, plane/sequence, trigger, report rule, audience, frames, required, prohibited, batch]
const ROWS: Row[] = [
  ['CLIN-N1-001', 'N1', 'T0', 'Portrait', 'Patient portrait', null, 'Case opening', UI_RULE, 'participant', 1, 'Photorealistic head-and-shoulders portrait of a healthy-appearing 64-year-old active woman; consistent appearance across the workspace', 'Resemblance to a real identifiable person, hospital logos, illness stereotypes', 2],
  ['CLIN-N1-002', 'N1', 'T0', 'Diagram', 'Pain distribution body map', null, 'Pain history', UI_RULE, 'participant', 1, 'Low-back pain and bilateral leg symptoms, right greater than left, with right L5 predominance', 'S1-dominant or cervical distribution', 2],
  ['CLIN-N1-003', 'N1', 'T-14m to T0', 'Diagram', 'Symptom and treatment timeline', null, 'Expanded history', UI_RULE, 'participant', 1, 'Progressive symptoms, supervised therapy, analgesics, and temporary response to a right L5 selective nerve-root block', 'Prior lumbar surgery or unplanned red flags', 2],
  ['CLIN-N1-004', 'N1', 'T0', 'Clinical record', 'Neurologic examination record', null, 'Request physical examination', UI_RULE, 'participant', 1, 'Right EHL MRC 4+/5, mild intermittent right dorsal-foot sensory change, no upper motor neuron signs', 'Cauda equina syndrome, foot drop, or major motor deficit', 2],
  ['PROM-N1-001', 'N1', 'T0', 'UI panel', 'Patient-reported measures', null, 'Functional assessment', UI_RULE, 'participant', 1, 'ODI 42%, back pain 6/10, right leg pain 8/10, left leg pain 5/10, walking tolerance about 180 m', 'Values inconsistent with the clinical master', 2],
  ['XR-N2-001', 'N2', 'T+7d', 'Radiograph', 'Standing lumbar AP', 'Coronal projection', 'Request standing lumbar radiographs', IMG_RULE, 'participant', 1, 'Preserved coronal balance, mild degenerative change, no destructive lesion', 'Meaningful scoliosis, fracture, or instrumentation', 2],
  ['XR-N2-002', 'N2', 'T+7d', 'Radiograph', 'Standing lumbar lateral', 'Lateral projection', 'Request standing lumbar radiographs', IMG_RULE, 'participant', 1, 'L4-L5 translation 4.5 mm, partially preserved disc height, facet degeneration', 'High-grade slip, fracture, or hardware', 1],
  ['XR-N2-003', 'N2', 'T+7d', 'Radiograph', 'Lateral flexion', 'Lateral projection', 'Request flexion-extension radiographs', IMG_RULE, 'participant', 1, 'L4-L5 translation 6.0 mm in flexion', 'Pars defect or motion at the wrong level', 1],
  ['XR-N2-004', 'N2', 'T+7d', 'Radiograph', 'Lateral extension', 'Lateral projection', 'Request flexion-extension radiographs', IMG_RULE, 'participant', 1, 'L4-L5 translation reduces to 3.0 mm; angular change across flexion-extension is 8 degrees', 'Complete reduction or severe hypermobility', 1],
  ['EOS-N2-001', 'N2', 'T+7d', 'Radiograph', 'Standing full-spine AP', 'Coronal projection', 'Request full-length standing radiographs', IMG_RULE, 'participant', 1, 'Lumbar Cobb angle 7 degrees and no significant coronal imbalance', 'Structural deformity greater than the defined case', 2],
  ['EOS-N2-002', 'N2', 'T+7d', 'Radiograph', 'Standing full-spine lateral', 'Lateral projection', 'Request full-length standing radiographs', IMG_RULE, 'participant', 1, 'PI 55 degrees, LL 49 degrees, PT 21 degrees, SVA +30 mm', 'Marked sagittal imbalance', 2],
  ['MRI-N2-001', 'N2', 'T+10d', 'MRI', 'Sagittal T1', 'Sagittal / T1', 'Request lumbar MRI', IMG_RULE, 'participant', 14, 'Supine L4-L5 translation 2.5 mm, coherent marrow and epidural fat, mild adjacent-level degeneration', 'Tumor, infection, fracture, or prior surgery', 1],
  ['MRI-N2-002', 'N2', 'T+10d', 'MRI', 'Sagittal T2', 'Sagittal / T2', 'Request lumbar MRI', IMG_RULE, 'participant', 16, 'Severe L4-L5 stenosis, mild L3-L4 degeneration, mild L5-S1 degeneration without clinically relevant stenosis', 'Severe multilevel stenosis or unexpected conus abnormality', 1],
  ['MRI-N2-003', 'N2', 'T+10d', 'MRI', 'Axial T2, L3-L4', 'Axial / T2', 'Review lumbar MRI by level', IMG_RULE, 'participant', 14, 'Mild degeneration without clinically important neural compression', 'Severe L3-L4 stenosis', 2],
  ['MRI-N2-004', 'N2', 'T+10d', 'MRI', 'Axial T2, L4-L5', 'Axial / T2', 'Review lumbar MRI by level', IMG_RULE, 'participant', 18, 'Dural sac area about 58 mm2; severe central and bilateral lateral-recess stenosis, right greater than left; facet effusions 2.5 mm right and 1.8 mm left', 'Large disc extrusion, synovial cyst, or dominant foraminal stenosis', 1],
  ['MRI-N2-005', 'N2', 'T+10d', 'MRI', 'Axial T2, L5-S1', 'Axial / T2', 'Review lumbar MRI by level', IMG_RULE, 'participant', 14, 'Mild degeneration without clinically relevant stenosis', 'S1 compression', 2],
  ['CT-N2-001', 'N2', 'T+12d', 'CT', 'Sagittal bone window', 'Sagittal / bone window', 'Request lumbar CT', IMG_RULE, 'participant', 16, 'Grade I L4-L5 degenerative slip, facet degeneration, no pars defect, L1 attenuation about 118 HU', 'Fracture, lytic lesion, or vacuum phenomenon in the L4-L5 facets', 2],
  ['CT-N2-002', 'N2', 'T+12d', 'CT', 'Axial L4-L5 bone window', 'Axial / bone window', 'Review lumbar CT by level', IMG_RULE, 'participant', 18, 'Advanced bilateral facet arthrosis without facet vacuum; no pars defect', 'Facet gas, fracture, tumor, or unexpected calcified mass', 1],
  ['CT-N2-003', 'N2', 'T+12d', 'CT', 'Coronal bone window', 'Coronal / bone window', 'Request CT reconstructions', IMG_RULE, 'participant', 16, 'Symmetric pedicles, mild L4-L5 degeneration, no segmentation anomaly', 'Relevant scoliosis or anomalous segmentation', 2],
  ['EMG-N2-001', 'N2', 'T+12d', 'Report', 'EMG and nerve conduction report', null, 'Request neurophysiology', DOC_RULE, 'participant', 1, 'Mild chronic right L5 radiculopathy without active denervation; no polyneuropathy', 'Severe multilevel radiculopathy or active denervation', 2],
  ['LAB-N2-001', 'N2', 'T+12d', 'Report', 'Routine laboratory panel', null, 'Request laboratory studies', DOC_RULE, 'participant', 1, 'CBC, renal function, coagulation profile, and inflammatory markers within normal limits', 'Infection, anemia, renal failure, or coagulopathy', 2],
  ['DXA-N2-001', 'N2', 'T+12d', 'Report', 'DXA report', null, 'Request bone-density testing', DOC_RULE, 'participant', 1, 'Femoral-neck T-score -1.4, consistent with mild osteopenia', 'Osteoporosis', 2],
  ['INJ-N2-001', 'N2', 'T-6m', 'Record', 'Prior procedure record', null, 'Request prior procedure records', DOC_RULE, 'participant', 1, 'Substantial but temporary right-leg pain relief after a technically adequate right L5 block', 'Durable cure or a complication from the injection', 2],
  ['REP-N2-001', 'N2', 'T+12d', 'Report', 'Integrated radiology report', null, 'Complete and submit an independent image interpretation', 'Includes only studies released and independently interpreted in this session', 'participant', 1, 'Findings concordant with the defined L4-L5 disease and negative findings', 'Treatment recommendation or information not visible in the released images', 2],
  ['PLAN-N3-001', 'N3', 'T+14d', 'UI panel', 'Treatment-strategy comparison workspace', null, 'Management decision node', UI_RULE, 'participant', 1, 'Nonoperative care, decompression alone, and decompression with fusion; fields for benefits, risks, uncertainty, patient preferences, and confidence', 'Any option preselected or labeled correct', 2],
  ['PLAN-N3-002', 'N3', 'Debriefing', 'Annotated image', 'Annotated preoperative MRI key images', null, 'Case completion', DEBRIEF_RULE, 'participant_and_facilitator', 1, 'Principal level, lateral recesses, facet effusions, and dural sac area identified', 'Unvalidated labels or new findings', 4],
  ['PLAN-N3-003', 'N3', 'Debriefing', 'Annotated image', 'Annotated dynamic-radiograph set', null, 'Case completion', DEBRIEF_RULE, 'participant_and_facilitator', 1, 'Measurements of 4.5, 6.0, 3.0, and 2.5 mm shown with position labels; 8-degree angular change; supine MRI value distinguished from radiographic values', 'A universal instability threshold presented as the only correct interpretation', 4],
  ['OR-N4-001', 'N4', 'Operative day', 'Operative illustration', 'Operative field', null, 'Procedure review', UI_RULE, 'participant', 1, 'L4-L5 decompression field with limited cranial extension toward L3-L4 and preserved stabilizing anatomy', 'Instrumentation, interbody cage, or excessive facetectomy', 3],
  ['OR-N4-002', 'N4', 'Operative day', 'Operative illustration', 'Operative field at the checkpoint', null, 'Intraoperative checkpoint', UI_RULE, 'participant', 1, 'Approximately 4-mm dural defect in the right lateral recess with visible CSF', 'Root transection, large dural loss, or wrong level', 3],
  ['OR-N4-003', 'N4', 'Debriefing', 'Diagram', 'Annotated operative-site diagram', null, 'Case completion', DEBRIEF_RULE, 'participant_and_facilitator', 1, 'Right lateral-recess location, approximate size, and relationship to the decompression shown accurately', 'New nerve injury or extensive dural destruction', 3],
  ['DOC-N4-001', 'N4', 'Operative day', 'Report', 'Operative report', null, 'Complete intraoperative checkpoint', 'Released only after the intraoperative proposal is committed', 'participant', 1, 'L4-L5 decompression with limited cranial extension into L3-L4; no fusion or instrumentation; 4-mm right lateral-recess durotomy; primary suture repair with adjunctive sealant; negative Valsalva test', 'Future postoperative outcome or hardware', 3],
  ['CT-N4-001', 'N4', 'Postoperative', 'CT', 'Sagittal bone window', 'Sagittal / bone window', 'Request postoperative CT', IMG_RULE, 'participant', 12, 'Expected L4-L5 decompression with limited cranial extension toward L3-L4; no fusion or instrumentation', 'Excessive facet removal, fracture, or hardware', 3],
  ['CT-N4-002', 'N4', 'Postoperative', 'CT', 'Axial L4-L5 bone window', 'Axial / bone window', 'Review postoperative CT by level', IMG_RULE, 'participant', 16, 'Adequate bilateral lateral-recess decompression with facet preservation and no fracture', 'Iatrogenic instability depicted as gross bone loss or any implant', 3],
  ['CLIN-N4-001', 'N4', 'POD3', 'Photograph', 'Wound dressing photograph', null, 'Inspect the wound', UI_RULE, 'participant', 1, 'Small clear serous stain without marked erythema, purulence, or dehiscence', 'Heavy bleeding, pus, or extensive wound breakdown', 3],
  ['LAB-N4-001', 'N4', 'POD1-POD4', 'Report', 'Postoperative laboratory trend', null, 'Request postoperative laboratory studies', DOC_RULE, 'participant', 1, 'Expected mild postoperative leukocytosis trending down; no laboratory pattern of infection', 'Sepsis, severe anemia, or unexplained organ failure', 3],
  ['MRI-N4-001', 'N4', 'POD4', 'MRI', 'Sagittal T2', 'Sagittal / T2', 'Request postoperative MRI', IMG_RULE, 'participant', 18, 'CSF-intensity dorsal epidural and subfascial collection measuring about 48 x 18 x 55 mm and communicating with the operative bed', 'Compressive hematoma, abscess, or severe neural compression', 3],
  ['MRI-N4-002', 'N4', 'POD4', 'MRI', 'Axial T2, L4-L5', 'Axial / T2', 'Review postoperative MRI by level', IMG_RULE, 'participant', 18, 'Continuity between the collection and decompression bed; mild mass effect without severe neural compression', 'Abscess or major cauda equina compression', 3],
  ['MRI-N4-003', 'N4', 'POD4', 'MRI', 'Coronal T2', 'Coronal / T2', 'Review coronal reconstruction', IMG_RULE, 'participant', 14, 'Collection extent consistent with 55-mm craniocaudal dimension and no remote paraspinal extension', 'Extensive paravertebral abscess or another level of disease', 3],
  ['DOC-N4-002', 'N4', 'POD1-POD7', 'Clinical notes', 'Postoperative nursing and progress notes', null, 'Review clinical records', 'Branch-aware; only experienced entries are shown', 'participant', 1, 'Postural headache and increasing clear drainage with mobilization on day 3; lumbar drain course and resolution documented according to the selected branch', 'Fever, new deficit, or hidden reoperation in the reference pathway', 3],
  ['XR-N5-001', 'N5', 'Week 6', 'Radiograph', 'Standing lumbar AP', 'Coronal projection', 'Request follow-up radiographs', IMG_RULE, 'participant', 1, 'Expected postoperative decompression context, no new coronal deformity, no hardware', 'Instrumentation, fracture, or infection', 4],
  ['XR-N5-002', 'N5', 'Week 6', 'Radiograph', 'Standing lumbar lateral', 'Lateral projection', 'Request follow-up radiographs', IMG_RULE, 'participant', 1, 'Persistent grade I L4-L5 slip without clear early progression; no instrumentation', 'Cage, pedicle screws, or high-grade progression', 4],
  ['OUT-N5-001', 'N5', 'Week 6', 'UI panel', 'Six-week functional outcome summary', null, 'Clinical follow-up', UI_RULE, 'participant', 1, 'Walking tolerance 900 m, back pain 3/10, right leg pain 2/10, ODI 24%, right EHL 5/5, healed wound, no recurrent headache or drainage', 'Perfect recovery or complete absence of residual symptoms', 4],
  ['FAC-N5-001', 'N5', 'Case completion', 'UI panel', 'Layered participant reasoning map', null, 'Debriefing', DEBRIEF_RULE, 'participant_and_facilitator', 1, 'Chronological reasoning trace, study rationale and expected findings, interpretations, hypothesis changes, key decisions, alternative pathways, consequences, confidence, and reflection prompts', 'Binary right-wrong labels, pass-fail decision, or a single global score', 4],
];

export const ASSET_MANIFEST: AssetManifestEntry[] = ROWS.map((r) => ({
  asset_id: r[0],
  case_id: CASE_ID,
  node: r[1],
  relative_timing: r[2],
  modality: r[3],
  generic_title: r[4],
  plane_or_sequence: r[5],
  release_trigger: r[6],
  report_release_rule: r[7],
  audience: r[8],
  expected_frame_count: r[9],
  frame_paths: null,
  required_findings: r[10],
  prohibited_findings: r[11],
  version: 'v01',
  approval_state: 'Planned',
  source_policy: SOURCE,
  reviewers: null,
  production_batch: r[12],
  spacing_mm: null,
  orientation: 'unverified',
}));

/** Normalized filename pattern for approved frames (spec section 15). */
export function frameFileName(assetId: string, version: string, audience: string, frame: number): string {
  return `${CASE_ID}__${assetId}__${version}__${audience}__frame-${String(frame).padStart(3, '0')}.png`;
}
