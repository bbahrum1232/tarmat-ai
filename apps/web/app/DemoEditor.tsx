"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Clip = {
  id: number;
  title: string;
  start: number;
  end: number;
  caption: string;
  score: number;
};

const aspectRatios = {
  "9:16": { width: 720, height: 1280, description: "Shorts · Reels · TikTok" },
  "4:5": { width: 864, height: 1080, description: "Instagram feed" },
  "1:1": { width: 1080, height: 1080, description: "Square posts" },
  "16:9": { width: 1280, height: 720, description: "Landscape video" }
} as const;

type AspectRatio = keyof typeof aspectRatios;
type CropMode = "cover" | "contain";
type CaptionPosition = "top" | "center" | "bottom";

const platformPresets: Array<{ label: string; detail: string; ratio: AspectRatio }> = [
  { label: "TikTok · Reels · Shorts", detail: "Vertical 9:16", ratio: "9:16" },
  { label: "Instagram feed", detail: "Portrait 4:5", ratio: "4:5" },
  { label: "Square post", detail: "Square 1:1", ratio: "1:1" },
  { label: "YouTube", detail: "Landscape 16:9", ratio: "16:9" }
];

const demoCaptions = [
  "A moment worth sharing.",
  "This is the part you don't want to miss.",
  "A little moment. A big impact."
];

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function seekTo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.05) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("The video could not seek to the selected moment."));
    }, 5000);
    const onSeeked = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = time;
  });
}

export default function DemoEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [cropMode, setCropMode] = useState<CropMode>("cover");
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>("bottom");
  const [captionScale, setCaptionScale] = useState(1);
  const [captionBackground, setCaptionBackground] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isPreviewingClip, setIsPreviewingClip] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [batchExportingIndex, setBatchExportingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedId) ?? null,
    [clips, selectedId]
  );
  const selectedClipStart = selectedClip?.start;

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
    },
    []
  );

  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      selectedClipStart === undefined ||
      video.readyState < HTMLMediaElement.HAVE_METADATA
    ) return;
    video.pause();
    video.currentTime = selectedClipStart;
  }, [selectedClipStart, sourceUrl]);

  function loadFile(nextFile: File | undefined) {
    if (!nextFile) return;
    if (isAnalyzing || exportingId !== null || batchExportingIndex !== null) return;
    if (!nextFile.type.startsWith("video/")) {
      setError("Choose a video file to start.");
      return;
    }

    const nextUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setSourceUrl(nextUrl);
    setDuration(0);
    setAnalysisProgress(0);
    setClips([]);
    setSelectedId(null);
    setError("");
    setNotice("Video loaded in your browser. Your file is not uploaded to a server.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isAnalyzing || exportingId !== null || batchExportingIndex !== null) return;
    loadFile(event.dataTransfer.files[0]);
  }

  function addClip() {
    const video = videoRef.current;
    if (!video || duration < 1) {
      setError("Wait for the video to load before adding a clip.");
      return;
    }

    const clipLength = Math.min(15, Math.max(5, duration * 0.2), duration);
    const start = Math.max(0, Math.min(video.currentTime, duration - clipLength));
    const id = Math.max(0, ...clips.map((clip) => clip.id)) + 1;
    const clip: Clip = {
      id,
      title: `Custom clip ${id}`,
      start,
      end: start + clipLength,
      caption: "",
      score: 0
    };

    setClips((current) => [...current, clip]);
    setSelectedId(id);
    setError("");
    setNotice(
      "Added a custom clip from the current preview position. Adjust its IN and OUT points before exporting."
    );
  }

  function removeClip(clipId: number) {
    const remainingClips = clips.filter((clip) => clip.id !== clipId);
    setClips(remainingClips);
    if (selectedId === clipId) {
      setSelectedId(remainingClips[0]?.id ?? null);
    }
  }

  function applyPlatformPreset(ratio: AspectRatio) {
    setAspectRatio(ratio);
    setCropMode("cover");
    setFocusX(50);
    setFocusY(50);
    setCaptionPosition("bottom");
    setCaptionScale(1);
    setCaptionBackground(true);
    setNotice(
      `Export setup is ready for ${
        platformPresets.find((preset) => preset.ratio === ratio)?.label ?? ratio
      }.`
    );
  }

  async function toggleClipPreview() {
    const video = videoRef.current;
    if (!video || !selectedClip) return;

    if (!video.paused) {
      video.pause();
      video.currentTime = selectedClip.start;
      return;
    }

    setError("");
    try {
      if (
        video.currentTime < selectedClip.start ||
        video.currentTime >= selectedClip.end
      ) {
        await seekTo(video, selectedClip.start);
      }
      await video.play();
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "The selected clip could not be played in the preview."
      );
    }
  }

  async function analyzeVideo() {
    const video = videoRef.current;
    if (!file || !Number.isFinite(duration) || duration <= 0) {
      setError("Wait for the video to load, then try again.");
      return;
    }
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      setError("Wait for the video preview to finish loading, then try again.");
      return;
    }
    if (duration < 1) {
      setError("This video is too short to create a clip.");
      return;
    }

    setError("");
    setNotice("");
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    const previousTime = video.currentTime;

    try {
      video.pause();
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 36;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Could not prepare the video for visual analysis.");

      const sampleCount = Math.min(180, Math.max(12, Math.ceil(duration / 1.5)));
      const sampleTimes = Array.from(
        { length: sampleCount },
        (_, index) => 0.1 + (Math.max(0, duration - 0.2) * index) / (sampleCount - 1)
      );
      const motionSamples: Array<{ time: number; score: number }> = [];
      let previousFrame: Uint8ClampedArray | null = null;

      for (const [index, time] of sampleTimes.entries()) {
        await seekTo(video, time);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let difference = 0;

        if (previousFrame) {
          for (let pixel = 0; pixel < pixels.length; pixel += 4) {
            const luminance =
              0.2126 * Math.abs(pixels[pixel] - previousFrame[pixel]) +
              0.7152 * Math.abs(pixels[pixel + 1] - previousFrame[pixel + 1]) +
              0.0722 * Math.abs(pixels[pixel + 2] - previousFrame[pixel + 2]);
            difference += luminance;
          }
          difference /= (pixels.length / 4) * 255;
          motionSamples.push({ time, score: difference });
        }

        previousFrame = new Uint8ClampedArray(pixels);
        setAnalysisProgress(Math.round(((index + 1) / sampleCount) * 100));
      }

      const clipLength = Math.min(25, Math.max(5, duration * 0.22), duration);
      const clipCount = Math.min(3, Math.max(1, Math.floor(duration / clipLength)));
      const finalStart = Math.max(0, duration - clipLength);
      const step = Math.max(0.5, clipLength / 4);
      const starts: number[] = [];
      for (let start = 0; start < finalStart; start += step) starts.push(start);
      starts.push(finalStart);

      const candidates = starts.map((start) => {
        const end = start + clipLength;
        const scores = motionSamples
          .filter((sample) => sample.time >= start && sample.time <= end)
          .map((sample) => sample.score);
        const score = scores.length
          ? scores.reduce((total, value) => total + value, 0) / scores.length
          : 0;
        return { start, end, score };
      });
      const strongestScore = Math.max(...candidates.map((candidate) => candidate.score));
      const picked = strongestScore > 0.005
        ? candidates
          .slice()
          .sort((first, second) => second.score - first.score)
            .reduce<typeof candidates>((selected, candidate) => {
              if (
                selected.length < clipCount &&
                selected.every(
                  (item) => candidate.end <= item.start || candidate.start >= item.end
                )
              ) {
                selected.push(candidate);
              }
              return selected;
            }, [])
            .sort((first, second) => first.start - second.start)
        : [];
      const selectedWindows =
        picked.length > 0
          ? picked
          : Array.from({ length: clipCount }, (_, index) => ({
              start:
                clipCount === 1
                  ? finalStart / 2
                  : (finalStart * index) / (clipCount - 1),
              end: 0,
              score: 0
            })).map((candidate) => ({
              ...candidate,
              end: candidate.start + clipLength
            }));

      const nextClips = selectedWindows.map((window, index): Clip => ({
        id: index + 1,
        title: strongestScore > 0.005 ? `High-motion moment ${index + 1}` : `Suggested moment ${index + 1}`,
        start: window.start,
        end: window.end,
        caption: demoCaptions[index],
        score:
          strongestScore > 0.005
            ? Math.max(1, Math.round((window.score / strongestScore) * 100))
            : 0
      }));

      setClips(nextClips);
      setSelectedId(nextClips[0].id);
      setNotice(
        strongestScore > 0.005
          ? "Suggestions are ranked by visual motion in the video. This demo does not understand speech or identify meaning."
          : "No notable visual motion was detected. Showing evenly spaced sample moments instead."
      );
    } catch (analysisError) {
      setClips([]);
      setSelectedId(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "The video could not be analyzed."
      );
    } finally {
      try {
        await seekTo(video, previousTime);
      } catch {
        setError("Analysis finished, but the video preview could not return to its previous position.");
      }
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }

  async function exportClip(clip: Clip) {
    const video = videoRef.current;
    if (!video || !sourceUrl) return false;
    const activeVideo = video;
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      setError("Clip export is not supported by this browser. Try a current version of Chrome or Edge.");
      return false;
    }

    setError("");
    setNotice("");
    setExportingId(clip.id);
    let recorder: MediaRecorder | null = null;
    let canvasStream: MediaStream | null = null;
    let animationFrame = 0;
    let handleRecordingVideoEvent: (() => void) | null = null;

    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) throw new Error("Audio export is not supported by this browser.");

      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContextConstructor();
        audioContextRef.current = audioContext;
        audioDestinationRef.current = audioContext.createMediaStreamDestination();
        audioSourceRef.current = audioContext.createMediaElementSource(activeVideo);
        audioSourceRef.current.connect(audioDestinationRef.current);
        audioSourceRef.current.connect(audioContext.destination);
      }
      await audioContext.resume();

      const canvas = document.createElement("canvas");
      const output = aspectRatios[aspectRatio];
      canvas.width = output.width;
      canvas.height = output.height;
      const context =
        canvas.getContext("2d") ??
        (() => {
          throw new Error("Could not prepare the video for export.");
        })();

      await seekTo(activeVideo, clip.start);
      canvasStream = canvas.captureStream(30);
      for (const track of audioDestinationRef.current?.stream.getAudioTracks() ?? []) {
        canvasStream.addTrack(track);
      }

      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser does not support WebM video export.");

      const chunks: BlobPart[] = [];
      recorder = new MediaRecorder(canvasStream, { mimeType });
      const activeRecorder = recorder;
      const stopRecording = () => {
        activeVideo.pause();
        if (activeRecorder.state === "recording") activeRecorder.stop();
      };
      handleRecordingVideoEvent = () => {
        drawFrame(false);
        if (activeVideo.currentTime >= clip.end || activeVideo.ended) {
          stopRecording();
        }
      };
      activeVideo.addEventListener("timeupdate", handleRecordingVideoEvent);
      activeVideo.addEventListener("ended", handleRecordingVideoEvent);
      const recordingFinished = new Promise<Blob>((resolve, reject) => {
        activeRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        activeRecorder.onerror = () => reject(new Error("The browser could not export this clip."));
        activeRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      function drawFrame(scheduleNextFrame = true) {
        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          activeVideo.videoWidth > 0 &&
          activeVideo.videoHeight > 0
        ) {
          context.fillStyle = "#000000";
          context.fillRect(0, 0, canvas.width, canvas.height);
          const scale =
            (cropMode === "cover" ? Math.max : Math.min)(
              canvas.width / activeVideo.videoWidth,
              canvas.height / activeVideo.videoHeight
            );
          const width = activeVideo.videoWidth * scale;
          const height = activeVideo.videoHeight * scale;
          context.drawImage(
            activeVideo,
            cropMode === "cover" ? (canvas.width - width) * (focusX / 100) : (canvas.width - width) / 2,
            cropMode === "cover" ? (canvas.height - height) * (focusY / 100) : (canvas.height - height) / 2,
            width,
            height
          );

          const captionText = clip.caption.trim();
          const captionLines = captionText ? captionText.split(/\s+/) : [];
          context.textAlign = "center";
          context.textBaseline = "middle";
          const fontSize = Math.round(canvas.width * 0.064 * captionScale);
          context.font = `700 ${fontSize}px Arial, sans-serif`;
          context.lineWidth = Math.max(5, Math.round(fontSize * 0.16));
          context.strokeStyle = "#000000";
          context.fillStyle = "#ffffff";
          const maxLineWidth = canvas.width * 0.86;
          const lines: string[] = [];
          let line = "";
          for (const word of captionLines) {
            const candidate = line ? `${line} ${word}` : word;
            if (line && context.measureText(candidate).width > maxLineWidth) {
              lines.push(line);
              line = word;
            } else {
              line = candidate;
            }
          }
          if (line) lines.push(line);
          const visibleLines = lines.slice(0, 4);
          const lineHeight = Math.round(fontSize * 1.22);
          const blockHeight = visibleLines.length * lineHeight;
          const firstLineY =
            captionPosition === "top"
              ? canvas.height * 0.14 + lineHeight / 2
              : captionPosition === "center"
                ? (canvas.height - blockHeight) / 2 + lineHeight / 2
                : canvas.height * 0.84 - blockHeight / 2 + lineHeight / 2;
          visibleLines.forEach((captionLine, index) => {
            const y = firstLineY + index * lineHeight;
            if (captionBackground) {
              const lineWidth = Math.min(context.measureText(captionLine).width, maxLineWidth);
              context.fillStyle = "rgba(0, 0, 0, 0.62)";
              context.fillRect(
                canvas.width / 2 - lineWidth / 2 - fontSize * 0.16,
                y - lineHeight * 0.42,
                lineWidth + fontSize * 0.32,
                lineHeight * 0.84
              );
            }
            context.fillStyle = "#ffffff";
            context.strokeText(captionLine, canvas.width / 2, y, maxLineWidth);
            context.fillText(captionLine, canvas.width / 2, y, maxLineWidth);
          });
        }

        if (activeVideo.currentTime >= clip.end || activeVideo.ended) {
          stopRecording();
          return;
        }
        if (scheduleNextFrame) {
          animationFrame = window.requestAnimationFrame(() => drawFrame());
        }
      }

      recorder.start(250);
      await activeVideo.play();
      animationFrame = window.requestAnimationFrame(() => drawFrame());
      const blob = await recordingFinished;
      if (blob.size === 0) throw new Error("The exported video was empty. Please try again.");

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `tarmat-clip-${clip.id}-${aspectRatio.replace(":", "x")}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      setNotice(`Your ${aspectRatio} WebM clip was exported.`);
      return true;
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "The video could not be exported.";
      setError(message);
      return false;
    } finally {
      if (handleRecordingVideoEvent) {
        activeVideo.removeEventListener("timeupdate", handleRecordingVideoEvent);
        activeVideo.removeEventListener("ended", handleRecordingVideoEvent);
      }
      window.cancelAnimationFrame(animationFrame);
      activeVideo.pause();
      if (recorder?.state === "recording") recorder.stop();
      canvasStream?.getVideoTracks().forEach((track) => track.stop());
      setExportingId(null);
    }
  }

  async function exportAllClips() {
    setError("");
    setNotice("");
    for (const [index, clip] of clips.entries()) {
      setBatchExportingIndex(index + 1);
      setSelectedId(clip.id);
      const exported = await exportClip(clip);
      if (!exported) {
        setBatchExportingIndex(null);
        return;
      }
      if (index < clips.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    }
    setBatchExportingIndex(null);
    setNotice(
      `Batch export finished: ${clips.length} WebM ${clips.length === 1 ? "clip was" : "clips were"} rendered.`
    );
  }

  const features = [
    ["01", "Motion-based suggestions", "Find visually active sections of your video."],
    ["02", "Platform-ready formats", "Export vertical, portrait, square, or landscape."],
    ["03", "Fine-tuned framing", "Adjust the crop, clip timing, and caption style."],
    ["04", "Local WebM export", "Render clips in your browser without uploading."]
  ];

  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#top" aria-label="Tarmat.ai home">
          <span className="dot" />
          tarmat<span>.ai</span>
        </a>
        <span className="demo-badge">BROWSER DEMO</span>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">VIDEO CLIPPER · VISUAL ANALYSIS DEMO</div>
        <h1>
          Turn long videos into
          <br />
          <em>short-form clips.</em>
        </h1>
        <p className="lead">
          Upload a video to find visually active moments, customize demo captions, and export
          vertical clips. Your video stays on this device.
        </p>
        <div className="actions">
          <button
            className="primary"
            onClick={() => inputRef.current?.click()}
            disabled={isAnalyzing || exportingId !== null || batchExportingIndex !== null}
          >
            Choose a video
          </button>
          <a className="secondary" href="#editor">
            View editor
          </a>
        </div>
      </section>

      <section className="beginner-guide" aria-label="Quick start guide">
        <div className="beginner-guide-heading">
          <span className="eyebrow">NEW TO CLIPPING?</span>
          <strong>Follow these four steps</strong>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Choose a video</strong>
              <small>Pick a file from your device.</small>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Find moments</strong>
              <small>Let the demo suggest active sections.</small>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Preview and adjust</strong>
              <small>Choose a moment and trim its start/end.</small>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <strong>Choose a platform and export</strong>
              <small>Video stays on this device.</small>
            </div>
          </li>
        </ol>
      </section>

      <section className="editor" id="editor">
        <div className="panel source-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-title">Your video</div>
              <p className="panel-subtitle">Select a video file from your device.</p>
            </div>
            {file && (
              <button
                className="text-button"
                onClick={() => inputRef.current?.click()}
                disabled={isAnalyzing || exportingId !== null || batchExportingIndex !== null}
              >
                Change video
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="video/*"
            disabled={isAnalyzing || exportingId !== null || batchExportingIndex !== null}
            onChange={handleFileChange}
            aria-label="Choose a video file"
          />

          {!file ? (
            <div
              className={`dropzone${isDragging ? " is-dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="upload-icon" aria-hidden="true">
                ↑
              </div>
              <strong>Drop a video here</strong>
              <span>MP4, MOV, or WebM. Your video stays on this device.</span>
              <button
                className="upload"
                onClick={() => inputRef.current?.click()}
                disabled={isAnalyzing || exportingId !== null || batchExportingIndex !== null}
              >
                Browse files
              </button>
            </div>
          ) : (
            <div className="source-details">
              <div className="file-icon" aria-hidden="true">
                ▶
              </div>
              <div className="file-copy">
                <strong title={file.name}>{file.name}</strong>
                <span>
                  {duration ? `${formatTime(duration)} · ` : "Loading video · "}
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <span className="local-pill">ON DEVICE</span>
            </div>
          )}

          {file && (
            <button
              className="primary analyze-button"
              onClick={analyzeVideo}
              disabled={
                isAnalyzing ||
                duration <= 0 ||
                exportingId !== null ||
                batchExportingIndex !== null
              }
            >
              {isAnalyzing
                ? `Analyzing video... ${analysisProgress}%`
                : clips.length
                  ? "Analyze again"
                  : "Find clip moments"}
            </button>
          )}
          {isAnalyzing && (
            <div
              className="analysis-progress"
              role="progressbar"
              aria-label="Analyzing video frames"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={analysisProgress}
            >
              <span style={{ width: `${analysisProgress}%` }} />
            </div>
          )}

          {error && (
            <p className="message error-message" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="message notice-message" role="status">
              {notice}
            </p>
          )}
          <p className="privacy-note">
            This demo compares sampled video frames on your device to suggest visually active
            moments. It does not upload video, transcribe speech, or understand the scene. Captions
            are editable examples, not generated subtitles.
          </p>
        </div>

        <div className="panel preview-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-title">{aspectRatio} preview</div>
              <p className="panel-subtitle">
                {cropMode === "cover" ? "Fill frame" : "Show full frame"} · caption preview
              </p>
            </div>
            <span className="format-pill">{aspectRatio}</span>
          </div>

          <div
          className={`phone${sourceUrl ? " has-video" : ""}`}
          style={{
            aspectRatio: `${aspectRatios[aspectRatio].width} / ${aspectRatios[aspectRatio].height}`,
            width:
              aspectRatio === "16:9"
                ? "min(100%, 360px)"
                : aspectRatio === "1:1"
                  ? "min(100%, 300px)"
                  : "min(100%, 230px)"
          }}
          >
          {sourceUrl ? (
            <video
              ref={videoRef}
              className="source-video"
              src={sourceUrl}
              style={{
                objectFit: cropMode,
                objectPosition: `${focusX}% ${focusY}%`
              }}
                onLoadedMetadata={(event) => {
                  const videoDuration = event.currentTarget.duration;
                  if (Number.isFinite(videoDuration) && videoDuration > 0) {
                    setDuration(videoDuration);
                    setError("");
                  } else {
                    setError("Could not read the duration of this video.");
                  }
                }}
                onError={() => setError("This video format could not be played by your browser.")}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;
                  if (
                    exportingId === null &&
                    selectedClip &&
                    video.currentTime >= selectedClip.end &&
                    !video.paused
                  ) {
                    video.currentTime = selectedClip.start;
                  }
                }}
                onPlay={() => setIsPreviewingClip(true)}
                onPause={() => setIsPreviewingClip(false)}
                controls={exportingId === null}
                playsInline
              />
            ) : (
              <div className="phone-inner">
                <div className="play" aria-hidden="true">
                  ▶
                </div>
                <div className="caption">
                  Your best moments,
                  <br />
                  <b>ready for Shorts.</b>
                </div>
              </div>
            )}
            {selectedClip && sourceUrl && (
              <div
                className={`preview-caption caption-${captionPosition}${captionBackground ? " with-background" : ""}`}
                style={{ fontSize: `${14 * captionScale}px` }}
                aria-live="polite"
              >
                {selectedClip.caption || " "}
              </div>
            )}
          </div>
          <div className="status">
            {selectedClip
              ? `${formatTime(selectedClip.start)} – ${formatTime(selectedClip.end)}`
              : file
                ? "Choose “Find clip moments” to start"
                : "Waiting for a video"}
          </div>
          {sourceUrl && (
            <button
              className="preview-clip-button"
              onClick={() => void toggleClipPreview()}
              disabled={
                !selectedClip ||
                isAnalyzing ||
                exportingId !== null ||
                batchExportingIndex !== null
              }
            >
              {isPreviewingClip ? "Pause clip preview" : "Preview selected clip"}
            </button>
          )}
          <div className="output-settings">
            <div className="settings-heading">Export settings</div>
            <div className="platform-presets" aria-label="Platform export presets">
              <span className="platform-presets-label">Quick setup for a platform</span>
              <div className="platform-presets-grid">
                {platformPresets.map((preset) => (
                  <button
                    key={preset.ratio}
                    type="button"
                    className="platform-preset"
                    aria-pressed={aspectRatio === preset.ratio}
                    disabled={exportingId !== null || batchExportingIndex !== null}
                    onClick={() => applyPlatformPreset(preset.ratio)}
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.detail}</small>
                  </button>
                ))}
              </div>
            </div>
            <label className="setting-field">
              <span>Aspect ratio</span>
              <select
                value={aspectRatio}
                disabled={exportingId !== null || batchExportingIndex !== null}
                onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}
              >
                {Object.entries(aspectRatios).map(([ratio, preset]) => (
                  <option key={ratio} value={ratio}>
                    {ratio} · {preset.description}
                  </option>
                ))}
              </select>
            </label>
            <label className="setting-field">
              <span>Frame crop</span>
              <select
                value={cropMode}
                disabled={exportingId !== null || batchExportingIndex !== null}
                onChange={(event) => setCropMode(event.target.value as CropMode)}
              >
                <option value="cover">Fill frame · crop edges</option>
                <option value="contain">Show full video · add bars</option>
              </select>
            </label>
            {cropMode === "cover" && (
              <div className="focus-controls">
                <label>
                  <span>Horizontal focus</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={focusX}
                    disabled={exportingId !== null || batchExportingIndex !== null}
                    onChange={(event) => setFocusX(Number(event.target.value))}
                    aria-label="Horizontal crop focus"
                  />
                </label>
                <label>
                  <span>Vertical focus</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={focusY}
                    disabled={exportingId !== null || batchExportingIndex !== null}
                    onChange={(event) => setFocusY(Number(event.target.value))}
                    aria-label="Vertical crop focus"
                  />
                </label>
              </div>
            )}
            <div className="caption-settings">
              <label className="setting-field">
                <span>Caption position</span>
                <select
                  value={captionPosition}
                  disabled={exportingId !== null || batchExportingIndex !== null}
                  onChange={(event) => setCaptionPosition(event.target.value as CaptionPosition)}
                >
                  <option value="top">Top</option>
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
              <label className="setting-field">
                <span>Caption size</span>
                <select
                  value={captionScale}
                  disabled={exportingId !== null || batchExportingIndex !== null}
                  onChange={(event) => setCaptionScale(Number(event.target.value))}
                >
                  <option value={0.8}>Small</option>
                  <option value={1}>Medium</option>
                  <option value={1.2}>Large</option>
                </select>
              </label>
            </div>
            <label className="toggle-setting">
              <input
                type="checkbox"
                checked={captionBackground}
                disabled={exportingId !== null || batchExportingIndex !== null}
                onChange={(event) => setCaptionBackground(event.target.checked)}
              />
              <span>Caption background</span>
            </label>
          </div>
        </div>
      </section>

      {sourceUrl && duration > 0 && (
        <section className="clips-section" aria-labelledby="clips-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR EDITS · VISUAL MOTION SUGGESTIONS</div>
              <h2 id="clips-title">Clip moments</h2>
            </div>
            <div className="clip-actions">
              <span className="clips-count">
                {clips.length} {clips.length === 1 ? "clip" : "clips"}
              </span>
              <button
                className="export-all-button"
                onClick={() => void exportAllClips()}
                disabled={
                  clips.length === 0 ||
                  exportingId !== null ||
                  batchExportingIndex !== null ||
                  isAnalyzing
                }
              >
                {batchExportingIndex !== null
                  ? `Exporting ${batchExportingIndex}/${clips.length}...`
                  : "Export all clips"}
              </button>
              <button
                className="add-clip-button"
                onClick={addClip}
                disabled={exportingId !== null || batchExportingIndex !== null || isAnalyzing}
              >
                Add custom clip
              </button>
            </div>
          </div>

          {clips.length > 0 ? (
            <div className="clip-list">
              {clips.map((clip) => (
                <article
                  className={`clip-card${clip.id === selectedId ? " selected" : ""}`}
                  key={clip.id}
                >
                  <div className="clip-card-heading">
                    <button
                      className="clip-select"
                      onClick={() => setSelectedId(clip.id)}
                      disabled={exportingId !== null || batchExportingIndex !== null}
                      aria-pressed={clip.id === selectedId}
                      aria-label={`Preview ${clip.title}`}
                    >
                      <span className="clip-play" aria-hidden="true">
                        ▶
                      </span>
                      <span>
                        <strong>{clip.title}</strong>
                        <small>
                          {formatTime(clip.start)} – {formatTime(clip.end)}
                        </small>
                      </span>
                      <span className="score">
                        {clip.score
                          ? `${clip.score}% motion`
                          : clip.title.startsWith("Custom clip")
                            ? "custom"
                            : "low motion"}
                      </span>
                    </button>
                    <button
                      className="remove-clip-button"
                      onClick={() => removeClip(clip.id)}
                      disabled={exportingId !== null || batchExportingIndex !== null || isAnalyzing}
                      aria-label={`Remove ${clip.title}`}
                      title={`Remove ${clip.title}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="clip-timing">
                    <label>
                      Start
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, clip.end - 1)}
                        step={0.1}
                        value={clip.start.toFixed(1)}
                        disabled={exportingId !== null || batchExportingIndex !== null}
                        aria-label={`${clip.title} start time in seconds`}
                        onFocus={() => setSelectedId(clip.id)}
                        onChange={(event) => {
                          const value = event.currentTarget.valueAsNumber;
                          if (!Number.isFinite(value)) return;
                          setClips((current) =>
                            current.map((item) =>
                              item.id === clip.id
                                ? {
                                    ...item,
                                    start: Math.max(0, Math.min(value, item.end - 1))
                                  }
                                : item
                            )
                          );
                        }}
                      />
                      <span className="timing-suffix">sec</span>
                    </label>
                    <label>
                      End
                      <input
                        type="number"
                        min={clip.start + 1}
                        max={duration}
                        step={0.1}
                        value={clip.end.toFixed(1)}
                        disabled={exportingId !== null || batchExportingIndex !== null}
                        aria-label={`${clip.title} end time in seconds`}
                        onFocus={() => setSelectedId(clip.id)}
                        onChange={(event) => {
                          const value = event.currentTarget.valueAsNumber;
                          if (!Number.isFinite(value)) return;
                          setClips((current) =>
                            current.map((item) =>
                              item.id === clip.id
                                ? {
                                    ...item,
                                    end: Math.min(duration, Math.max(value, item.start + 1))
                                  }
                                : item
                            )
                          );
                        }}
                      />
                      <span className="timing-suffix">sec</span>
                    </label>
                  </div>
                  <div className="trim-sliders">
                    <label>
                      <span>IN</span>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, clip.end - 1)}
                        step={0.1}
                        value={clip.start}
                        disabled={exportingId !== null || batchExportingIndex !== null}
                        aria-label={`${clip.title} trim start`}
                        onFocus={() => setSelectedId(clip.id)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setClips((current) =>
                            current.map((item) =>
                              item.id === clip.id
                                ? { ...item, start: Math.min(value, item.end - 1) }
                                : item
                            )
                          );
                        }}
                      />
                    </label>
                    <label>
                      <span>OUT</span>
                      <input
                        type="range"
                        min={Math.min(duration, clip.start + 1)}
                        max={duration}
                        step={0.1}
                        value={clip.end}
                        disabled={exportingId !== null || batchExportingIndex !== null}
                        aria-label={`${clip.title} trim end`}
                        onFocus={() => setSelectedId(clip.id)}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setClips((current) =>
                            current.map((item) =>
                              item.id === clip.id
                                ? { ...item, end: Math.max(value, item.start + 1) }
                                : item
                            )
                          );
                        }}
                      />
                    </label>
                  </div>
                  <label className="caption-field">
                    <span>Caption example</span>
                    <input
                      value={clip.caption}
                      maxLength={120}
                      disabled={exportingId !== null || batchExportingIndex !== null}
                      onFocus={() => setSelectedId(clip.id)}
                      onChange={(event) => {
                        setSelectedId(clip.id);
                        setClips((current) =>
                          current.map((item) =>
                            item.id === clip.id ? { ...item, caption: event.target.value } : item
                          )
                        );
                      }}
                    />
                  </label>
                  <button
                    className="export-button"
                    onClick={() => void exportClip(clip)}
                    disabled={
                      exportingId !== null || batchExportingIndex !== null || isAnalyzing
                    }
                  >
                    {exportingId === clip.id ? "Rendering..." : "Export WebM"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-clips-message">
              No clip suggestions yet. Analyze the video or add a custom clip from the current preview position.
            </p>
          )}
          <p className="export-note">
            Exports use your selected framing and caption settings. For batch downloads, allow
            multiple downloads if your browser asks, and keep this tab open while rendering.
          </p>
        </section>
      )}

      <section className="features" aria-label="Demo features">
        {features.map(([number, title, description]) => (
          <article key={number}>
            <div className="feature-number">{number}</div>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer className="footer">
        Tarmat.ai browser demo · Video stays on your device and is not uploaded.
      </footer>

    </main>
  );
}
