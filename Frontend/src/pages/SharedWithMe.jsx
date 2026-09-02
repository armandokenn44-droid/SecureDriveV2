import { useEffect, useState, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function cleanName(key) {
  const raw = (key || "").split("/").filter(Boolean).pop() || key || "file";
  return raw.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    ""
  );
}

function formatSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SharedWithMe() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replacingId, setReplacingId] = useState(null);
  const fileInputRef = useRef(null);
  const pendingReplaceRef = useRef(null);

  // Navigation dans un dossier partagé
  const [browsePath, setBrowsePath] = useState(null); // null = liste des shares
  const [browseName, setBrowseName] = useState("");
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderFolders, setFolderFolders] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browsePerm, setBrowsePerm] = useState("Read Only");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    loadShares();
  }, []);

  async function loadShares() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/shares/with-me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load shared files");
        return;
      }
      setShares(data.shares || []);
    } catch {
      setError("Cannot connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function openSharedFolder(item) {
    const path = item.file_key.endsWith("/") ? item.file_key : item.file_key + "/";
    setBrowsePath(path);
    setBrowseName(item.file_name || cleanName(path));
    setBrowsePerm(item.permission || "Read Only");
    setBrowseLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE}/api/files?path=${encodeURIComponent(path)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not open folder");
        setBrowsePath(null);
        return;
      }
      setFolderFolders(data.folders || []);
      setFolderFiles(
        (data.files || []).map((f) => ({
          key: f.key,
          name: cleanName(f.key),
          size: f.size,
        }))
      );
    } catch {
      setError("Cannot connect to server");
      setBrowsePath(null);
    } finally {
      setBrowseLoading(false);
    }
  }

  function backToShares() {
    setBrowsePath(null);
    setBrowseName("");
    setFolderFiles([]);
    setFolderFolders([]);
  }

  async function handleDownload(fileKey, fileName) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_BASE}/api/files/download?key=${encodeURIComponent(fileKey)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Cannot connect to server");
    }
  }

  function startReplace(item) {
    pendingReplaceRef.current = {
      fileKey: item.file_key || item.key,
      shareId: item.id,
    };
    fileInputRef.current?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    const pending = pendingReplaceRef.current;
    e.target.value = "";
    if (!file || !pending) return;

    setReplacingId(pending.shareId);
    const token = localStorage.getItem("token");
    try {
      const formData = new FormData();
      formData.append("key", pending.fileKey);
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/files/replace`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not update file");
        return;
      }
      alert("File updated successfully on SecureDrive");
    } catch {
      alert("Cannot connect to server");
    } finally {
      setReplacingId(null);
      pendingReplaceRef.current = null;
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  function isFolderShare(item) {
    return item.isFolder === true || (item.file_key && item.file_key.endsWith("/"));
  }

  // Vue : contenu d'un dossier partagé
  if (browsePath) {
    return (
      <div>
        <h2 className="page-heading">📁 {browseName}</h2>
        <p className="page-subtext">
          Shared folder · {browsePerm}
        </p>
        <button
          type="button"
          className="btn btn-outline"
          style={{ marginBottom: 16 }}
          onClick={backToShares}
        >
          ← Back to Shared with me
        </button>

        {error && <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>}

        <div className="table-card">
          {browseLoading ? (
            <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
          ) : folderFolders.length === 0 && folderFiles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">This folder is empty</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {folderFolders.map((f) => (
                  <tr key={f.key}>
                    <td style={{ fontWeight: 600 }}>📁 {f.name}</td>
                    <td>—</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() =>
                          openSharedFolder({
                            file_key: f.key,
                            file_name: f.name,
                            permission: browsePerm,
                          })
                        }
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {folderFiles.map((f) => (
                  <tr key={f.key}>
                    <td style={{ fontWeight: 600 }}>📄 {f.name}</td>
                    <td>{formatSize(f.size)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Download"
                        onClick={() => handleDownload(f.key, f.name)}
                      >
                        <DownloadIcon />
                      </button>
                      {browsePerm === "Read & Write" && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ marginLeft: 6, fontSize: "0.8rem" }}
                          onClick={() =>
                            startReplace({ file_key: f.key, id: f.key })
                          }
                        >
                          Update
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <input ref={fileInputRef} type="file" hidden onChange={onFileChosen} />
      </div>
    );
  }

  // Vue : liste des partages
  return (
    <div>
      <h2 className="page-heading">Shared With Me</h2>
      <p className="page-subtext">
        Files and folders that other team members shared with you.
      </p>

      <input ref={fileInputRef} type="file" hidden onChange={onFileChosen} />

      {error && <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>}

      <div className="table-card">
        {loading ? (
          <div style={{ padding: 24, textAlign: "center" }}>Loading…</div>
        ) : shares.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShareIcon />
            </div>
            <div className="empty-state-title">Nothing shared with you yet</div>
            <div className="empty-state-text">
              Files and folders shared by teammates will show up here.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Shared By</th>
                <th>Permissions</th>
                <th>Date Shared</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((item) => {
                const folder = isFolderShare(item);
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>
                      {folder ? "📁 " : "📄 "}
                      {item.file_name}
                      {folder && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.75rem",
                            color: "#64748b",
                          }}
                        >
                          Folder
                        </span>
                      )}
                    </td>
                    <td>
                      {item.owner_first_name} {item.owner_last_name}
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {item.owner_email}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          item.permission === "Read Only" ? "tag-gray" : "tag-amber"
                        }`}
                      >
                        {item.permission}
                      </span>
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        {folder ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ fontSize: "0.8rem" }}
                            onClick={() => openSharedFolder(item)}
                          >
                            Open folder
                          </button>
                        ) : (
                          <>
                            <button
                              className="icon-btn"
                              title="Download"
                              onClick={() =>
                                handleDownload(item.file_key, item.file_name)
                              }
                            >
                              <DownloadIcon />
                            </button>
                            {item.permission === "Read & Write" && (
                              <button
                                className="btn btn-outline"
                                title="Replace file"
                                disabled={replacingId === item.id}
                                onClick={() => startReplace(item)}
                                style={{ marginLeft: 6, fontSize: "0.8rem" }}
                              >
                                {replacingId === item.id ? "Updating…" : "Update file"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8.2 10.8L15.8 7.2M8.2 13.2l7.6 3.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v12M6 12l6 6 6-6" />
      <path d="M4 20h16" />
    </svg>
  );
}