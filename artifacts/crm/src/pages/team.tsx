import { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Zap, ImageIcon, FileText, Video,
  Send, Trash2, Loader2, Upload, X, FileDown, Play, Monitor,
  Mail, Inbox, ChevronDown, Link2, Copy, Check,
} from "lucide-react";

const API = (path: string) => `/api/team/${path}`;
const FULL_URL = (path: string) => `${window.location.origin}/api/team/${path}`;

function EndpointFooter({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = FULL_URL(path);
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div className="mt-6 flex items-center gap-2 px-4 py-3 bg-muted/50 border border-border/60 rounded-xl text-xs text-muted-foreground">
      <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-medium mr-1">JSON endpoint:</span>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="font-mono truncate text-primary hover:underline underline-offset-2 flex-1 min-w-0"
        data-testid="endpoint-url">{url}</a>
      <button onClick={copy} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted transition" title="Copy URL">
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function authHeaders(contentType = "application/json") {
  return { "Content-Type": contentType, Authorization: `Bearer ${getToken()}` };
}

async function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers as Record<string, string> ?? {}) } });
}

function formatTime(value: string) {
  return value || "";
}

const STATUS_STYLES: Record<string, string> = {
  notice: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  urgent: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// ── Shared Item Card ──────────────────────────────────────────────────────────

function ItemCard({ author, time, onDelete, canDelete, children }: {
  author: string; time: string; onDelete: () => void; canDelete: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-background rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-accent-foreground">{author.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-semibold">{author}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{time}</span>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

type Message = { id: number; text: string; createdAt: string; userId: string; authorEmail: string | null };

function MessagesTab({ userEmail, userId, isAdmin }: { userEmail: string; userId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useState(() => {
    apiFetch(API("messages"))
      .then((r) => r.json())
      .then(setMessages)
      .finally(() => setLoading(false));
  });

  async function load() {
    const r = await apiFetch(API("messages"));
    setMessages(await r.json());
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const r = await apiFetch(API("messages"), { method: "POST", body: JSON.stringify({ text }) });
    if (r.ok) { setText(""); await load(); } else { toast({ title: "Failed to send", variant: "destructive" }); }
    setSending(false);
  }

  async function del(id: number) {
    await apiFetch(API(`messages/${id}`), { method: "DELETE" });
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share something with the team…"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="message-input"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            data-testid="send-message"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post Message
          </button>
        </div>
      </form>

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/40 text-amber-800 dark:text-amber-400 text-xs">
        <span className="mt-0.5 flex-shrink-0">⚠️</span>
        <span>Messages posted here are visible to everyone in the company. Please keep content professional and relevant.</span>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No messages yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <ItemCard
              key={m.id}
              author={m.authorEmail?.split("@")[0] ?? "Unknown"}
              time={formatTime(m.createdAt)}
              onDelete={() => del(m.id)}
              canDelete={isAdmin || m.userId === userId}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
            </ItemCard>
          ))}
        </div>
      )}
      <EndpointFooter path="messages" />
    </div>
  );
}

// ── Updates Tab ───────────────────────────────────────────────────────────────

type Update = { id: number; status: string; text: string; createdAt: string; userId: string; authorEmail: string | null };

function UpdatesTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ status: "notice", text: "" });
  const [sending, setSending] = useState(false);

  useState(() => {
    apiFetch(API("updates"))
      .then((r) => r.json())
      .then(setUpdates)
      .finally(() => setLoading(false));
  });

  async function load() {
    const r = await apiFetch(API("updates"));
    setUpdates(await r.json());
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return;
    setSending(true);
    const r = await apiFetch(API("updates"), { method: "POST", body: JSON.stringify(form) });
    if (r.ok) { setForm((p) => ({ ...p, text: "" })); await load(); } else { toast({ title: "Failed to post", variant: "destructive" }); }
    setSending(false);
  }

  async function del(id: number) {
    await apiFetch(API(`updates/${id}`), { method: "DELETE" });
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="update-status"
          >
            <option value="notice">Notice</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>
          <input
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            placeholder="What's happening?"
            className="flex-1 px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="update-text"
          />
          <button
            type="submit"
            disabled={sending || !form.text.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
            data-testid="post-update"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Post
          </button>
        </div>
      </form>

      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/40 text-amber-800 dark:text-amber-400 text-xs">
        <span className="mt-0.5 flex-shrink-0">⚠️</span>
        <span>Updates posted here are visible to everyone in the company. Please keep content professional and relevant.</span>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : updates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No updates yet. Share your status!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <ItemCard
              key={u.id}
              author={u.authorEmail?.split("@")[0] ?? "Unknown"}
              time={formatTime(u.createdAt)}
              onDelete={() => del(u.id)}
              canDelete={isAdmin || u.userId === userId}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide", STATUS_STYLES[u.status] ?? STATUS_STYLES.notice)}>
                  {u.status}
                </span>
                <span className="text-sm leading-relaxed">{u.text}</span>
              </div>
            </ItemCard>
          ))}
        </div>
      )}
      <EndpointFooter path="updates" />
    </div>
  );
}

// ── Photos Tab ────────────────────────────────────────────────────────────────

type Photo = { id: number; caption: string | null; data: string; createdAt: string; userId: string; authorEmail: string | null };

function PhotosTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    apiFetch(API("photos"))
      .then((r) => r.json())
      .then(setPhotos)
      .finally(() => setLoading(false));
  });

  async function load() {
    const r = await apiFetch(API("photos"));
    setPhotos(await r.json());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setFileData(data);
      setPreview(data);
    };
    reader.readAsDataURL(file);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileData) return;
    setUploading(true);
    const r = await apiFetch(API("photos"), { method: "POST", body: JSON.stringify({ data: fileData, caption }) });
    if (r.ok) {
      setCaption(""); setPreview(null); setFileData(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  }

  async function del(id: number) {
    await apiFetch(API(`photos/${id}`), { method: "DELETE" });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <form onSubmit={upload} className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="flex gap-3 items-start">
          <div className="flex-1 space-y-3">
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Click to choose an image</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {preview && (
            <div className="relative flex-shrink-0">
              <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-border" />
              <button type="button" onClick={() => { setPreview(null); setFileData(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={uploading || !fileData}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          data-testid="upload-photo"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          Upload Photo
        </button>
      </form>

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No photos yet. Upload the first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative rounded-xl overflow-hidden border border-border aspect-square bg-muted cursor-pointer" onClick={() => setLightbox(p)}>
              <img src={p.data} alt={p.caption ?? ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              {(isAdmin || p.userId === userId) && (
                <button
                  onClick={(e) => { e.stopPropagation(); del(p.id); }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {p.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                  <p className="text-white text-xs truncate">{p.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl max-h-[85vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.data} alt={lightbox.caption ?? ""} className="max-h-[75vh] object-contain rounded-xl" />
            <div className="flex items-center justify-between text-white/70 text-sm px-1">
              <span>{lightbox.authorEmail?.split("@")[0]} · {formatTime(lightbox.createdAt)}</span>
              {lightbox.caption && <span className="italic">{lightbox.caption}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

type Doc = { id: number; name: string; data: string; createdAt: string; userId: string; authorEmail: string | null };

function DocumentsTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    apiFetch(API("documents"))
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  });

  async function load() {
    const r = await apiFetch(API("documents"));
    setDocs(await r.json());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!name) setName(file.name.replace(/\.pdf$/i, ""));
    const reader = new FileReader();
    reader.onload = (ev) => setFileData(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileData || !name.trim()) return;
    setUploading(true);
    const r = await apiFetch(API("documents"), { method: "POST", body: JSON.stringify({ name: name.trim(), data: fileData }) });
    if (r.ok) {
      setName(""); setFileData(null); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  }

  async function del(id: number) {
    await apiFetch(API(`documents/${id}`), { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function download(doc: Doc) {
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.name.endsWith(".pdf") ? doc.name : `${doc.name}.pdf`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
            <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{fileName || "Choose a PDF file"}</span>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Document name *"
            required
            className="px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={uploading || !fileData || !name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          data-testid="upload-document"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Upload Document
        </button>
      </form>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No documents yet. Upload a PDF to share with the team.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border group hover:border-primary/30 transition">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.authorEmail?.split("@")[0]} · {formatTime(d.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => download(d)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  title="Download"
                >
                  <FileDown className="w-4 h-4" />
                </button>
                {(isAdmin || d.userId === userId) && (
                  <button
                    onClick={() => del(d.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                    title="Delete"
                    data-testid={`delete-doc-${d.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Videos Tab ────────────────────────────────────────────────────────────────

type VideoItem = { id: number; title: string; originalName: string; createdAt: string; userId: string; authorEmail: string | null };

function VideosTab({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    apiFetch(API("videos"))
      .then((r) => r.json())
      .then(setVideos)
      .finally(() => setLoading(false));
  });

  async function load() {
    const r = await apiFetch(API("videos"));
    setVideos(await r.json());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim() || file.name.replace(/\.[^.]+$/, ""));

    return new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", API("videos"));
      xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };

      xhr.onload = async () => {
        if (xhr.status === 201) {
          setTitle(""); setFile(null); setProgress(0);
          if (fileRef.current) fileRef.current.value = "";
          await load();
        } else {
          toast({ title: "Upload failed", description: "Could not save video", variant: "destructive" });
        }
        setUploading(false);
        resolve();
      };

      xhr.onerror = () => {
        toast({ title: "Upload failed", description: "Network error", variant: "destructive" });
        setUploading(false);
        resolve();
      };

      xhr.send(formData);
    });
  }

  async function del(id: number) {
    await apiFetch(API(`videos/${id}`), { method: "DELETE" });
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (playing === id) setPlaying(null);
  }

  function openDashboard(id: number) {
    window.open(`/api/team/videos/${id}/player`, "_blank", "noopener,noreferrer");
  }

  function streamUrl(id: number) {
    return `/api/team/videos/${id}/stream`;
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <form onSubmit={upload} className="bg-card border border-card-border rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition">
            <Video className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">{file?.name || "Choose an MP4 video"}</span>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title (optional)"
            className="px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span><span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={uploading || !file}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          data-testid="upload-video"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? `Uploading ${progress}%` : "Upload Video"}
        </button>
      </form>

      {/* Video list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No videos yet. Upload one to share with the team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id} className="bg-background rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Video className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.authorEmail?.split("@")[0]} · {formatTime(v.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setPlaying(playing === v.id ? null : v.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition"
                    title={playing === v.id ? "Hide player" : "Play video"}
                    data-testid={`play-video-${v.id}`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {playing === v.id ? "Hide" : "Play"}
                  </button>
                  <button
                    onClick={() => openDashboard(v.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40 text-xs font-medium transition"
                    title="Open fullscreen on dashboard / TV display"
                    data-testid={`dashboard-video-${v.id}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Dashboard
                  </button>
                  {(isAdmin || v.userId === userId) && (
                    <button
                      onClick={() => del(v.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      title="Delete video"
                      data-testid={`delete-video-${v.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline player */}
              {playing === v.id && (
                <div className="border-t border-border bg-black">
                  <video
                    key={v.id}
                    src={streamUrl(v.id)}
                    controls
                    autoPlay
                    className="w-full max-h-72 object-contain"
                    data-testid={`video-player-${v.id}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-muted/40 border border-border/50 rounded-xl text-xs text-muted-foreground">
        <Monitor className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          <strong className="font-medium text-foreground">Dashboard mode</strong> opens the video fullscreen with autoplay in a new tab — ideal for displaying on a TV or office screen (e.g. Dakboard).
        </span>
      </div>
    </div>
  );
}

// ── Direct Messages Tab ───────────────────────────────────────────────────────

interface DMMessage {
  id: number;
  body: string;
  createdAt: string;
  firstViewedAt: string | null;
  fromName?: string | null;
  fromEmail?: string;
  toName?: string | null;
  toEmail?: string;
}

interface DMRecipient {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
}

function dmSenderLabel(m: DMMessage) {
  const name = m.fromName?.trim() || m.fromEmail || "";
  return name ? name.split(/\s+/)[0] : "Unknown";
}
function dmRecipientLabel(m: DMMessage) {
  const name = m.toName?.trim() || m.toEmail || "";
  return name ? name.split(/\s+/)[0] : "Unknown";
}
function recipientLabel(r: DMRecipient) {
  return r.fullName?.trim() || r.email;
}
function dmTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 24) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DirectMessagesTab() {
  const { toast } = useToast();
  const [view, setView] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<DMMessage[]>([]);
  const [sent, setSent] = useState<DMMessage[]>([]);
  const [recipients, setRecipients] = useState<DMRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [toUserId, setToUserId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  function auth() { return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }; }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxRes, sentRes, recipRes] = await Promise.all([
        fetch("/api/dm/inbox", { headers: auth() }),
        fetch("/api/dm/sent", { headers: auth() }),
        fetch("/api/dm/recipients", { headers: auth() }),
      ]);
      setInbox(await inboxRes.json());
      setSent(await sentRes.json());
      setRecipients(await recipRes.json());
    } catch {
      toast({ title: "Failed to load messages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unread = inbox.filter((m) => !m.firstViewedAt);
    if (unread.length === 0) return;
    fetch("/api/dm/mark-viewed", { method: "POST", headers: auth() }).then(load).catch(() => {});
  }, [inbox]);

  async function handleSend() {
    if (!toUserId || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ toUserId, body: body.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.error ?? "Failed to send", variant: "destructive" });
        return;
      }
      toast({ title: "Message sent" });
      setBody("");
      setToUserId("");
      setView("sent");
      load();
    } finally {
      setSending(false);
    }
  }

  const unreadCount = inbox.filter((m) => !m.firstViewedAt).length;

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Mail className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Send a Direct Message</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To</label>
            <div className="relative">
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="w-full appearance-none bg-background border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-accent/30"
                data-testid="dm-recipient-select"
              >
                <option value="">Select a teammate…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>{recipientLabel(r)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Keep it short and sweet…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
              data-testid="dm-body-input"
            />
            <div className="text-right text-xs text-muted-foreground mt-1">{body.length}/500</div>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !toUserId || !body.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            data-testid="dm-send-btn"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send Message
          </button>
        </div>
      </div>

      {/* Inbox / Sent toggle */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex border-b border-border">
          <button
            onClick={() => setView("inbox")}
            className={cn("flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors",
              view === "inbox" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
            data-testid="dm-inbox-tab"
          >
            <Inbox className="w-4 h-4" />
            Inbox
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none font-semibold">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setView("sent")}
            className={cn("flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors",
              view === "sent" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
            data-testid="dm-sent-tab"
          >
            <Send className="w-4 h-4" />
            Sent
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : view === "inbox" ? (
          inbox.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No messages in your inbox</div>
          ) : (
            <div className="divide-y divide-border">
              {inbox.map((msg) => (
                <div key={msg.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">{dmSenderLabel(msg)}</span>
                    <span className="text-xs text-muted-foreground">{dmTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.body}</p>
                  {!msg.firstViewedAt && (
                    <span className="inline-block mt-1.5 text-xs font-medium text-accent">New</span>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          sent.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No sent messages</div>
          ) : (
            <div className="divide-y divide-border">
              {sent.map((msg) => (
                <div key={msg.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">To: {dmRecipientLabel(msg)}</span>
                    <span className="text-xs text-muted-foreground">{dmTime(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.body}</p>
                  {msg.firstViewedAt && (
                    <span className="text-xs text-muted-foreground mt-1 block">
                      Seen · expires {new Date(new Date(msg.firstViewedAt).getTime() + 5 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "messages" | "updates" | "photos" | "documents" | "videos" | "direct";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "updates", label: "Quick Updates", icon: Zap },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "videos", label: "Videos", icon: Video },
  { id: "direct", label: "Direct Messages", icon: Mail },
];

export default function TeamPage() {
  const { userEmail, userRole, userId } = useAuth();
  const [tab, setTab] = useState<Tab>("messages");
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const uid = userId ?? "";

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Messages, updates, photos, documents and videos for the whole team</p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`team-tab-${id}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "messages" && <MessagesTab userEmail={userEmail ?? ""} userId={uid} isAdmin={isAdmin} />}
        {tab === "updates" && <UpdatesTab userId={uid} isAdmin={isAdmin} />}
        {tab === "photos" && <PhotosTab userId={uid} isAdmin={isAdmin} />}
        {tab === "documents" && <DocumentsTab userId={uid} isAdmin={isAdmin} />}
        {tab === "videos" && <VideosTab userId={uid} isAdmin={isAdmin} />}
        {tab === "direct" && <DirectMessagesTab />}
      </div>
    </AppLayout>
  );
}
