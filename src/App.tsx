import { useState, useRef, useCallback } from "react";

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message: string;
  result?: any;
}

interface FormData {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
}

export default function App() {
  const [form, setForm] = useState<FormData>({
    id: "",
    name: "",
    price: "",
    category: "cars",
    description: "",
  });

  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [upload, setUpload] = useState<UploadState>({ status: "idle", message: "" });
  const [progress, setProgress] = useState(0);

  const glbRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  const adminSecret = import.meta.env.VITE_ADMIN_SECRET;

  const slugify = (text: string) =>
    text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((f) => ({ ...f, name, id: slugify(name) }));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, type: "glb" | "thumbnail" | "images") => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (type === "glb") setGlbFile(files[0]);
      if (type === "thumbnail") setThumbnailFile(files[0]);
      if (type === "images") setImageFiles((prev) => [...prev, ...files]);
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!glbFile) return alert("Please select a .glb file");
    if (!form.name || !form.category) return alert("Name and category are required");

    setUpload({ status: "uploading", message: "Uploading to S3..." });
    setProgress(10);

    const data = new FormData();
    data.append("id", form.id || slugify(form.name));
    data.append("name", form.name);
    data.append("price", form.price);
    data.append("category", form.category);
    data.append("description", form.description);
    data.append("glb", glbFile);
    if (thumbnailFile) data.append("thumbnail", thumbnailFile);
    imageFiles.forEach((img) => data.append("images", img));

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 85));
    }, 400);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret },
        body: data,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Upload failed");

      setUpload({ status: "success", message: json.message, result: json });
      setForm({ id: "", name: "", price: "", category: "cars", description: "" });
      setGlbFile(null);
      setThumbnailFile(null);
      setImageFiles([]);
    } catch (err: any) {
      clearInterval(progressInterval);
      setUpload({ status: "error", message: err.message });
    } finally {
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <div className="root">
      <div className="bg-grid" />

      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">3D ASSET UPLOADER</span>
            <span className="logo-bracket">]</span>
          </div>
          <div className="header-meta">S3 + SUPABASE PIPELINE</div>
        </div>
      </header>

      <main className="main">
        <div className="card">
          <div className="card-header">
            <span className="step-badge">01</span>
            <h2>Model Details</h2>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="field-row">
              <div className="field">
                <label>MODEL NAME <span className="req">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleNameChange}
                  placeholder="Mustang GT500"
                  required
                />
              </div>
              <div className="field field-sm">
                <label>AUTO ID</label>
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="mustang-gt500"
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field field-sm">
                <label>PRICE (USD) <span className="req">*</span></label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="499"
                  min="0"
                />
              </div>
              <div className="field field-sm">
                <label>CATEGORY <span className="req">*</span></label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="cars">Cars</option>
                  <option value="bikes">Bikes</option>
                  <option value="aircraft">Aircraft</option>
                  <option value="boats">Boats</option>
                  <option value="characters">Characters</option>
                  <option value="environments">Environments</option>
                  <option value="props">Props</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>DESCRIPTION</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the model..."
                rows={3}
              />
            </div>

            <div className="divider">
              <span className="step-badge">02</span>
              <h2>Files</h2>
            </div>

            {/* GLB Upload */}
            <div
              className={`drop-zone drop-zone-main ${glbFile ? "has-file" : ""}`}
              onDrop={(e) => handleDrop(e, "glb")}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => glbRef.current?.click()}
            >
              <input
                ref={glbRef}
                type="file"
                accept=".glb,.gltf"
                style={{ display: "none" }}
                onChange={(e) => setGlbFile(e.target.files?.[0] ?? null)}
              />
              {glbFile ? (
                <div className="file-ready">
                  <span className="file-icon">◈</span>
                  <span className="file-name">{glbFile.name}</span>
                  <span className="file-size">{(glbFile.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              ) : (
                <div className="drop-hint">
                  <span className="drop-icon">⬡</span>
                  <span className="drop-label">DROP .GLB FILE HERE</span>
                  <span className="drop-sub">or click to browse</span>
                </div>
              )}
            </div>

            <div className="field-row">
              {/* Thumbnail */}
              <div
                className={`drop-zone drop-zone-half ${thumbnailFile ? "has-file" : ""}`}
                onDrop={(e) => handleDrop(e, "thumbnail")}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => thumbRef.current?.click()}
              >
                <input
                  ref={thumbRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                />
                {thumbnailFile ? (
                  <div className="file-ready">
                    <img
                      src={URL.createObjectURL(thumbnailFile)}
                      className="thumb-preview"
                      alt="thumb"
                    />
                    <span className="file-name">{thumbnailFile.name}</span>
                  </div>
                ) : (
                  <div className="drop-hint">
                    <span className="drop-icon">◻</span>
                    <span className="drop-label">THUMBNAIL</span>
                    <span className="drop-sub">1:1 ratio recommended</span>
                  </div>
                )}
              </div>

              {/* Images */}
              <div
                className={`drop-zone drop-zone-half ${imageFiles.length > 0 ? "has-file" : ""}`}
                onDrop={(e) => handleDrop(e, "images")}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => imagesRef.current?.click()}
              >
                <input
                  ref={imagesRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) =>
                    setImageFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
                  }
                />
                {imageFiles.length > 0 ? (
                  <div className="file-ready">
                    <div className="image-grid">
                      {imageFiles.slice(0, 4).map((f, i) => (
                        <img
                          key={i}
                          src={URL.createObjectURL(f)}
                          className="img-preview"
                          alt={`img-${i}`}
                        />
                      ))}
                    </div>
                    <span className="file-name">{imageFiles.length} image(s)</span>
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={(e) => { e.stopPropagation(); setImageFiles([]); }}
                    >clear</button>
                  </div>
                ) : (
                  <div className="drop-hint">
                    <span className="drop-icon">▣</span>
                    <span className="drop-label">GALLERY IMAGES</span>
                    <span className="drop-sub">multiple files OK</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {progress > 0 && (
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            )}

            {/* Status Messages */}
            {upload.status === "success" && (
              <div className="status success">
                <span className="status-icon">✓</span>
                <div>
                  <div className="status-title">{upload.message}</div>
                  <div className="status-detail">
                    GLB → <code>{upload.result?.urls?.glb?.split("/").pop()}</code>
                  </div>
                </div>
              </div>
            )}
            {upload.status === "error" && (
              <div className="status error">
                <span className="status-icon">✕</span>
                <div className="status-title">{upload.message}</div>
              </div>
            )}

            <button
              type="submit"
              className={`submit-btn ${upload.status === "uploading" ? "loading" : ""}`}
              disabled={upload.status === "uploading"}
            >
              {upload.status === "uploading" ? (
                <span className="btn-inner">
                  <span className="spinner" /> UPLOADING...
                </span>
              ) : (
                <span className="btn-inner">
                  <span>⬆</span> UPLOAD TO S3 + SUPABASE
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Pipeline Visual */}
        <div className="pipeline">
          <div className="pipe-step active">
            <span className="pipe-icon">◈</span>
            <span>.GLB FILE</span>
          </div>
          <div className="pipe-arrow">→</div>
          <div className={`pipe-step ${upload.status === "uploading" || upload.status === "success" ? "active" : ""}`}>
            <span className="pipe-icon">☁</span>
            <span>AMAZON S3</span>
          </div>
          <div className="pipe-arrow">→</div>
          <div className={`pipe-step ${upload.status === "success" ? "active" : ""}`}>
            <span className="pipe-icon">⬡</span>
            <span>SUPABASE</span>
          </div>
          <div className="pipe-arrow">→</div>
          <div className={`pipe-step ${upload.status === "success" ? "active" : ""}`}>
            <span className="pipe-icon">◉</span>
            <span>LIVE ON SITE</span>
          </div>
        </div>
      </main>
    </div>
  );
}
