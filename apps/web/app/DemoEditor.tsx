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

const clipIdeas = [
  { title: "The opening moment", caption: "Every great story starts somewhere." },
  { title: "A moment worth sharing", caption: "This is the part you don't want to miss." },
  { title: "The final highlight", caption: "A little moment. A big impact." }
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
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
    const clip = clips.find((item) => item.id === selectedId);
    if (!video || !clip || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    video.pause();
    video.currentTime = clip.start;
  }, [selectedId, sourceUrl]);

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

  async function analyzeVideo() {
    if (!file || !Number.isFinite(duration) || duration <= 0) {
      setError("Wait for the video to load, then try again.");
      return;
    }
    if (duration < 1) {
      setError("This video is too short to create a clip.");
      return;
    }

    setError("");
    setNotice("");
    setIsAnalyzing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const clipLength = Math.min(25, Math.max(5, duration * 0.22), duration);
    const clipCount = Math.min(3, Math.max(1, Math.floor(duration / clipLength)));
    const nextClips = Array.from({ length: clipCount }, (_, index): Clip => {
      const start =
        clipCount === 1
          ? Math.max(0, (duration - clipLength) / 2)
          : ((duration - clipLength) * index) / (clipCount - 1);
      const idea = clipIdeas[index];
      return {
        id: index + 1,
        title: idea.title,
        start,
        end: start + clipLength,
        caption: idea.caption,
        score: 96 - index * 7
      };
    });

    setClips(nextClips);
    setSelectedId(nextClips[0].id);
    setIsAnalyzing(false);
    setNotice("Demo suggestions are ready. Moments and captions are examples, not AI analysis.");
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
      canvas.width = 720;
      canvas.height = 1280;
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
      const recordingFinished = new Promise<Blob>((resolve, reject) => {
        activeRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        activeRecorder.onerror = () => reject(new Error("The browser could not export this clip."));
        activeRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      function drawFrame() {
        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          activeVideo.videoWidth > 0 &&
          activeVideo.videoHeight > 0
        ) {
          const scale = Math.max(
            canvas.width / activeVideo.videoWidth,
            canvas.height / activeVideo.videoHeight
          );
          const width = activeVideo.videoWidth * scale;
          const height = activeVideo.videoHeight * scale;
          context.drawImage(
            activeVideo,
            (canvas.width - width) / 2,
            (canvas.height - height) / 2,
            width,
            height
          );

          const captionLines = clip.caption.trim().split(/\s+/);
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = "700 46px Arial, sans-serif";
          context.lineWidth = 8;
          context.strokeStyle = "rgba(0, 0, 0, 0.85)";
          context.fillStyle = "#ffffff";
          const maxLineWidth = canvas.width - 100;
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
          const visibleLines = lines.slice(0, 3);
          const lineHeight = 58;
          const firstLineY = canvas.height - 190 - ((visibleLines.length - 1) * lineHeight) / 2;
          visibleLines.forEach((captionLine, index) => {
            const y = firstLineY + index * lineHeight;
            context.strokeText(captionLine, canvas.width / 2, y, maxLineWidth);
            context.fillText(captionLine, canvas.width / 2, y, maxLineWidth);
          });
        }

        if (activeVideo.currentTime >= clip.end || activeVideo.ended) {
          activeVideo.pause();
          if (activeRecorder.state === "recording") activeRecorder.stop();
          return;
        }
        animationFrame = window.requestAnimationFrame(drawFrame);
      }

      recorder.start(250);
      await activeVideo.play();
      animationFrame = window.requestAnimationFrame(drawFrame);
      const blob = await recordingFinished;
      if (blob.size === 0) throw new Error("The exported video was empty. Please try again.");

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `tarmat-clip-${clip.id}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      setNotice("Your vertical clip was exported as a WebM file.");
      return true;
    } catch (exportError) {
      const message =
        exportError instanceof Error ? exportError.message : "The video could not be exported.";
      setError(message);
      return false;
    } finally {
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
    ["01", "Demo clip suggestions", "Create sample highlight segments from your video."],
    ["02", "Vertical 9:16 crop", "Frame the center of your video for short-form platforms."],
    ["03", "Editable demo captions", "Change the sample caption before exporting."],
    ["04", "Local WebM export", "Download a rendered clip directly from your browser."]
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
        <div className="eyebrow">AI VIDEO CLIPPER · DEMO MODE</div>
        <h1>
          Turn long videos into
          <br />
          <em>short-form clips.</em>
        </h1>
        <p className="lead">
          Try a browser-based editing demo. Upload a video, make sample clips, customize a caption,
          and export a vertical video.
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
              {isAnalyzing ? "Finding demo moments..." : clips.length ? "Analyze again" : "Find clip moments"}
            </button>
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
            Demo mode: no server upload, speech recognition, or AI analysis. Sample moments and
            captions are generated in your browser.
          </p>
        </div>

        <div className="panel preview-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-title">Vertical preview</div>
              <p className="panel-subtitle">9:16 center crop · captions burned into export</p>
            </div>
            {selectedClip && <span className="format-pill">9:16</span>}
          </div>

          <div className={`phone${sourceUrl ? " has-video" : ""}`}>
            {sourceUrl ? (
              <video
                ref={videoRef}
                className="source-video"
                src={sourceUrl}
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
                  if (selectedClip && video.currentTime >= selectedClip.end && !video.paused) {
                    video.currentTime = selectedClip.start;
                  }
                }}
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
              <div className="preview-caption" aria-live="polite">
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
        </div>
      </section>

      {clips.length > 0 && (
        <section className="clips-section" aria-labelledby="clips-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR EDITS · DEMO SUGGESTIONS</div>
              <h2 id="clips-title">Clip moments</h2>
            </div>
            <div className="clip-actions">
              <span className="clips-count">
                {clips.length} {clips.length === 1 ? "clip" : "clips"}
              </span>
              <button
                className="export-all-button"
                onClick={() => void exportAllClips()}
                disabled={exportingId !== null || batchExportingIndex !== null || isAnalyzing}
              >
                {batchExportingIndex !== null
                  ? `Exporting ${batchExportingIndex}/${clips.length}...`
                  : "Export all clips"}
              </button>
            </div>
          </div>

          <div className="clip-list">
            {clips.map((clip) => (
              <article
                className={`clip-card${clip.id === selectedId ? " selected" : ""}`}
                key={clip.id}
              >
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
                  <span className="score">{clip.score}% demo</span>
                </button>
                <label className="caption-field">
                  <span>Demo caption</span>
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
          <p className="export-note">
            Exports are center-cropped, captioned WebM videos. For batch downloads, allow multiple
            downloads if your browser asks, and keep this tab open while rendering.
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
        Tarmat.ai demo · Video stays in your browser and is not uploaded.
      </footer>

    </main>
  );
}
