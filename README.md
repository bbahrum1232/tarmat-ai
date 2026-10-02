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
- Generate sample clip suggestions and select a segment to preview.
- Customize its demo caption, export a vertical 9:16 WebM clip, or batch export
  all suggested clips.

The demo does not upload files, transcribe speech, or use AI. Clip suggestions
and captions are examples; exported clips are rendered in the browser and
downloaded to your device. Export requires a browser with MediaRecorder and
WebM support (for example, a current version of Chrome or Edge). A production
AI workflow still needs a backend, transcription, and video-processing workers.
