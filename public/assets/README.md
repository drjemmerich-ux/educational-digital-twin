# Approved synthetic image assets

No approved images are present in Prototype 1.5. Every asset package is a labelled technical
placeholder until it passes clinical, anatomic, radiologic, temporal, educational and visual review.

To add an approved package:

1. Place web-optimized frames here using the normalized name pattern
   `EDT-LUM-DUMMY-001__<ASSET-ID>__v01__participant__frame-001.png` (keep lossless masters and
   annotated teaching copies outside this folder).
2. In `src/case/assetManifest.ts`, set that asset's `frame_paths` to the ordered relative paths
   (for example `assets/EDT-LUM-DUMMY-001__MRI-N2-004__v01__participant__frame-001.png`),
   update `approval_state`, `version` and `reviewers`.
3. Rebuild. The viewer shows real frames for that series; all release gates are unchanged.
