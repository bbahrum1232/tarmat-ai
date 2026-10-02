const features = [
  ["AI Clip Detection", "Find candidate moments from your video."],
  ["Auto 9:16", "Reframe landscape footage for vertical short-form video."],
  ["AI Captions", "Generate timed subtitles automatically."],
  ["Batch Export", "Create multiple clips from one source."]
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span className="dot" />tarmat<span>.ai</span></div>
        <button className="ghost">Sign in</button>
      </nav>

      <section className="hero">
        <div className="eyebrow">AI VIDEO CLIPPER</div>
        <h1>Turn long videos into<br /><em>short-form clips.</em></h1>
        <p className="lead">
          Tarmat.ai analyzes authorized video, finds strong moments,
          reframes them for 9:16, and generates captions.
        </p>
        <div className="actions">
          <button className="primary">Create your first clips</button>
          <button className="secondary">View workflow</button>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panel-title">Start a project</div>
          <div className="dropzone">
            <div className="upload-icon">↑</div>
            <strong>Upload a video</strong>
            <span>MP4, MOV, WebM · your content or content you are authorized to process</span>
            <button className="upload">Choose video</button>
          </div>
          <div className="divider"><span>OR</span></div>
          <label className="label">Authorized source URL</label>
          <div className="urlrow">
            <input placeholder="Paste a permitted source URL..." />
            <button className="primary small">Analyze</button>
          </div>
        </div>

        <div className="panel preview">
          <div className="panel-title">Automatic editing</div>
          <div className="phone">
            <div className="phone-inner">
              <div className="play">▶</div>
              <div className="caption">Your best moments,<br /><b>ready for Shorts.</b></div>
            </div>
          </div>
          <div className="status">Waiting for a video</div>
        </div>
      </section>

      <section className="features">
        {features.map(([title, desc]) => (
          <article key={title}>
            <div className="feature-number">0{features.indexOf([title, desc]) + 1}</div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
