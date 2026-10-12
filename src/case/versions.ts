// Version bundle for Prototype 1.5. A session keeps the versions it started with.
export const CASE_ID = 'EDT-LUM-DUMMY-001' as const;
export const CONTENT_VERSION = 'edt-lum-dummy-001-handoff-1.0' as const;
export const UI_VERSION = 'ui-1.5.0' as const;
export const ENGINE_VERSION = 'engine-1.5.0' as const;
export const ASSET_MANIFEST_VERSION = 'manifest-1.0 (Visual Bible v0.1, 2026-09-29)' as const;
export const TUTOR_POLICY_VERSION = 'scripted-tutor-policy-1.0' as const;
export const EXPORT_SCHEMA_VERSION = 'edt-session-export-1.0' as const;

export interface VersionBundle {
  case_id: string;
  content_version: string;
  ui_version: string;
  engine_version: string;
  asset_manifest_version: string;
  tutor_policy_version: string;
}

export const CURRENT_VERSIONS: VersionBundle = {
  case_id: CASE_ID,
  content_version: CONTENT_VERSION,
  ui_version: UI_VERSION,
  engine_version: ENGINE_VERSION,
  asset_manifest_version: ASSET_MANIFEST_VERSION,
  tutor_policy_version: TUTOR_POLICY_VERSION,
};
