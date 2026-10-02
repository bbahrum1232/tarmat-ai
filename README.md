# Tarmat.ai

AI-assisted video repurposing platform for clippers.

## MVP
- Upload an authorized video source
- Analyze/transcribe video
- Detect candidate clips
- Convert to 9:16
- Generate captions
- Preview and export MP4

## Architecture
- Web: Next.js + React + TypeScript
- Video: FFmpeg worker
- Database: PostgreSQL + Prisma
- Storage: S3-compatible object storage
- AI: transcription + clip analysis

## Legal/rights
Tarmat.ai should process videos the user owns or is authorized to process.
Do not build or use the system to bypass platform restrictions or download
copyrighted material without permission.

## Run
Requirements: Node.js 20+, npm.

    npm install
    npm run dev

## Browser demo
The published GitHub Pages app includes a local-only video editing demo:
- Choose a local video or drag one into the editor.
- Analyze sampled video frames locally to find visually active sections, then
  select a segment to preview and adjust its start/end times with time fields
  or trim sliders.
- Set a 9:16, 4:5, 1:1, or 16:9 output, choose fill/fit and crop focus, style
  the example caption, then export one clip or batch export all suggestions.
- Add a custom clip from the current preview position, adjust its trim points,
  or remove clips you do not want to keep.

The demo does not upload files, transcribe speech, understand the scene, or use
AI. Clip suggestions are based on visual motion between sampled frames, not
semantic highlight detection. Captions are editable examples, not generated
subtitles. Exported clips are rendered in the browser and downloaded to your
device as WebM. Export requires a browser with MediaRecorder and WebM support
(for example, a current version of Chrome or Edge). A production AI workflow
still needs a backend, transcription, and video-processing workers.
