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

The initial UI is intentionally a scaffold. Video processing and AI workers
will be added in subsequent milestones.
