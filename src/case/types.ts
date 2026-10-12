// Shared case-content types. Content objects are frozen data; only the engine reads hidden content.

export interface SimTime {
  /** Stable machine code, e.g. "T0", "T+10d", "POD4", "W6". */
  code: string;
  /** Learner-facing label. */
  label: string;
}

export type InvestigationKind = 'imaging' | 'non_imaging';
export type InvestigationContext = 'preop' | 'postop' | 'followup';

/** Public (non-hidden) catalogue entry: names and modality only, never results. */
export interface InvestigationDef {
  id: string;
  title: string;
  kind: InvestigationKind;
  context: InvestigationContext;
  /** Generic neutral description shown before release. */
  description: string;
}

export interface ReportSection {
  heading: string;
  lines: string[];
}

export interface SeriesSpec {
  assetId: string;
  /** Generic title (modality and plane only). */
  title: string;
  plane: string | null;
  sequence: string | null;
  plannedFrameCount: number;
}

/** Hidden authored result for an investigation. Released only through engine events. */
export interface InvestigationResult {
  investigationId: string;
  acquiredAt: SimTime;
  series: SeriesSpec[];
  reportAssetId: string | null;
  reportTitle: string;
  sections: ReportSection[];
  /** Accessible authored finding summary, released after the same gate as the report. */
  accessibleSummary: string;
  /** Validated teaching annotations. None are validated in this build. */
  annotationAssetIds: string[];
}

export interface PresentationSnapshot {
  patient: {
    displayName: string;
    ageYears: number;
    sex: string;
    occupation: string;
    activity: string;
    heightCm: number;
    weightKg: number;
    bmi: number;
    portraitAssetId: string;
  };
  history: {
    chiefConcern: string;
    duration: string;
    walkingTolerance: string;
    aggravating: string[];
    relieving: string[];
    priorManagement: { when: string; what: string }[];
    preference: string;
    redFlagsAbsent: string[];
  };
  examination: { domain: string; finding: string }[];
  baselineMeasures: { label: string; value: string; note?: string }[];
}

export interface ClinicalUpdate {
  id: string;
  time: SimTime;
  title: string;
  lines: string[];
  notes?: { time: string; author: string; text: string }[];
  images?: { assetId: string; title: string; caption: string }[];
}

export interface OperativeContent {
  procedureTime: SimTime;
  procedureDescription: string[];
  checkpoint: ClinicalUpdate;
  teamAction: string[];
  operativeReport: { title: string; sections: ReportSection[] };
}

export type BranchId = 'B1' | 'B2' | 'B3' | 'B4';
export type BranchOptionId = 'opt_drain' | 'opt_observe' | 'opt_reexplore' | 'opt_defer' | 'opt_none';

export interface BranchStep {
  id: string;
  time: SimTime;
  title: string;
  lines: string[];
  notes?: { time: string; author: string; text: string }[];
}

export interface FollowUpContent {
  time: SimTime;
  title: string;
  measures: { label: string; baseline: string; followUp: string }[];
  lines: string[];
  unavailable: string[];
}
