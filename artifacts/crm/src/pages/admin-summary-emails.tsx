import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSummaryCustomizations,
  getGetSummaryCustomizationsQueryKey,
  useSaveSummaryCustomization,
  useResetSummaryCustomization,
  usePreviewSummaryCustomization,
  type SummaryEmailUser,
  type SummaryEmailPreview,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Info,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  RotateCcw,
  Eye,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Lock,
  BarChart2,
} from "lucide-react";

type Draft = { custom: boolean; ids: string[] };

function displayName(u: SummaryEmailUser | undefined, fallbackId?: string) {
  if (!u) return fallbackId ? `Unknown user (${fallbackId.slice(0, 8)})` : "Unknown user";
  return u.name?.trim() || u.email;
}

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function roleLabel(r: string) {
  return r === "superadmin" ? "Super Admin" : r === "admin" ? "Admin" : r === "sales" ? "Sales" : "Data Entry";
}

export default function AdminSummaryEmailsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useGetSummaryCustomizations({
    query: { queryKey: getGetSummaryCustomizationsQueryKey(), refetchOnWindowFocus: true, refetchInterval: 60000 },
  });
  const saveMut = useSaveSummaryCustomization();
  const resetMut = useResetSummaryCustomization();
  const previewMut = usePreviewSummaryCustomization();

  const [recipientId, setRecipientId] = useState<string>("");
  const [draft, setDraft] = useState<Draft>({ custom: false, ids: [] });
  const [base, setBase] = useState<Draft>({ custom: false, ids: [] });
  const [pendingRecipient, setPendingRecipient] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [addId, setAddId] = useState("");
  const [preview, setPreview] = useState<{ key: string; data: SummaryEmailPreview } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");
  const initializedFor = useRef<string | null>(null);

  const users = query.data?.users ?? [];
  const configs = query.data?.configurations ?? [];
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const recipient = userMap.get(recipientId);
  const salesUsers = useMemo(
    () => users.filter((u) => u.role === "sales").sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [users],
  );
  const recipients = useMemo(
    () => [...users].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [users],
  );

  // Refresh clean editors across admin sessions without clobbering local edits.
  useEffect(() => {
    if (!query.data || !recipientId) return;
    const sameRecipient = initializedFor.current === recipientId;
    if (sameRecipient && (draft.custom !== base.custom || !sameIds(draft.ids, base.ids))) return;
    const cfg = query.data.configurations.find((c) => c.recipientId === recipientId);
    const next: Draft = cfg ? { custom: true, ids: [...cfg.coworkerIds] } : { custom: false, ids: [] };
    if (sameRecipient && next.custom === base.custom && sameIds(next.ids, base.ids)) return;
    initializedFor.current = recipientId;
    setBase(next);
    setDraft(next);
    setAddId("");
    setPreview(null);
    setPreviewError(null);
  }, [query.data, recipientId]);

  const busy = saveMut.isPending || resetMut.isPending || previewMut.isPending;
  const dirty = draft.custom !== base.custom || !sameIds(draft.ids, base.ids);
  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);
  const draftKey = `${recipientId}|${draft.custom}|${draft.ids.join(",")}`;
  const previewStale = !!preview && preview.key !== draftKey;

  const available = salesUsers.filter((u) => u.id !== recipientId && !draft.ids.includes(u.id));

  function requestRecipient(id: string) {
    if (id === recipientId || busy) return;
    if (dirty) { setPendingRecipient(id); return; }
    switchTo(id);
  }
  function switchTo(id: string) {
    initializedFor.current = null;
    setPreview(null);
    setPreviewError(null);
    previewMut.reset();
    setRecipientId(id);
  }

  function edit(fn: (ids: string[]) => string[]) {
    setDraft((d) => ({ custom: true, ids: fn(d.ids) }));
  }
  function move(i: number, dir: -1 | 1) {
    edit((ids) => {
      const j = i + dir;
      if (j < 0 || j >= ids.length) return ids;
      const n = [...ids];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  async function handleSave() {
    if (!recipientId) return;
    const rid = recipientId;
    try {
      const saved = await saveMut.mutateAsync({ userId: rid, data: { coworkerIds: draft.ids } });
      if (initializedFor.current === rid) {
        const next = { custom: true, ids: [...saved.coworkerIds] };
        setBase(next);
        setDraft(next);
      }
      await queryClient.invalidateQueries({ queryKey: getGetSummaryCustomizationsQueryKey() });
      toast({ title: "Summary setup saved", description: `${displayName(userMap.get(rid))} will receive this layout on Monday and Friday.` });
    } catch (e) {
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleReset() {
    if (!recipientId) return;
    const rid = recipientId;
    setConfirmReset(false);
    try {
      await resetMut.mutateAsync({ userId: rid });
      if (initializedFor.current === rid) {
        const next = { custom: false, ids: [] };
        setBase(next);
        setDraft(next);
        setPreview(null);
      }
      await queryClient.invalidateQueries({ queryKey: getGetSummaryCustomizationsQueryKey() });
      toast({ title: "Restored default summary", description: "This recipient now receives the standard summary." });
    } catch (e) {
      toast({ title: "Failed to reset", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handlePreview() {
    if (!recipientId) return;
    const key = draftKey;
    const rid = recipientId;
    setPreviewError(null);
    try {
      const data = await previewMut.mutateAsync({
        userId: rid, data: { coworkerIds: draft.ids, useDefault: !draft.custom },
      });
      if (initializedFor.current !== rid) return;
      setPreview({ key, data });
      toast({ title: "Preview generated", description: "No email was sent." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Preview failed.";
      setPreviewError(msg);
      toast({ title: "Preview failed", description: msg, variant: "destructive" });
    }
  }

  const hasCoworkers = draft.ids.length > 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">Summary Email Recipients</h1>
              <p className="text-xs text-muted-foreground">Choose whose lead activity each person sees in their Monday and Friday summary</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href="/admin/report-builder" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition" data-testid="link-report-builder">
              <BarChart2 className="w-3.5 h-3.5" /> Report sections
            </Link>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border leading-relaxed flex gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>Applies only to the Monday and Friday summary emails. Each block uses the report sections currently enabled in the Report Builder, including lead notes. A coworker with nothing to report shows a "no activity" block.</p>
            <p>Every recipient also sees a company-wide table of each salesperson's lead entries from the last 7 days, compared with their saved weekly goal. Your selections below control detailed lead blocks, not this summary table.</p>
            <p>CRM access, follow-up reminders and past-due alerts are not affected. Recipients without a custom setup keep the default: sales reps see only their own leads, admins see team-wide activity. Admin recipients also get team totals once at the top when that section is enabled.</p>
          </div>
        </div>

        {query.isLoading ? (
          <div className="grid md:grid-cols-[260px_1fr] gap-5" aria-busy="true">
            <div className="h-80 rounded-xl bg-muted animate-pulse" />
            <div className="h-80 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 flex items-center justify-between gap-3" role="alert">
            <div className="text-sm">
              <div className="font-semibold text-destructive">Could not load summary settings</div>
              <div className="text-xs text-muted-foreground">{query.error instanceof Error ? query.error.message : "Request failed."}</div>
            </div>
            <button onClick={() => query.refetch()} disabled={query.isFetching} className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-60" data-testid="button-retry">
              <RefreshCw className={cn("w-3.5 h-3.5", query.isFetching && "animate-spin")} /> Retry
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-[260px_1fr] gap-5 items-start">
            {/* Recipient list */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-card-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient</div>
              {recipients.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">No users found.</div>
              ) : (
                <ul className="max-h-[520px] overflow-y-auto p-1.5 space-y-0.5" role="listbox" aria-label="Summary recipients">
                  {recipients.map((u) => {
                    const active = u.id === recipientId;
                    const custom = configs.some((c) => c.recipientId === u.id);
                    return (
                      <li key={u.id}>
                        <button
                          role="option"
                          aria-selected={active}
                          disabled={busy && !active}
                          onClick={() => requestRecipient(u.id)}
                          className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition disabled:opacity-50", active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                          data-testid={`button-recipient-${u.id}`}
                        >
                          <div className="font-medium truncate">{displayName(u)}</div>
                          <div className={cn("text-[11px] flex gap-1.5", active ? "text-accent-foreground/70" : "text-muted-foreground")}>
                            <span>{roleLabel(u.role)}</span>
                            <span>·</span>
                            <span>{custom ? "Custom" : "Default"}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Editor */}
            {!recipient ? (
              <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
                <Mail className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-semibold">Select a recipient</div>
                <p className="text-xs text-muted-foreground mt-1">Pick someone on the left to set up whose activity appears in their summary.</p>
              </div>
            ) : (
              <div className="space-y-5 min-w-0">
                <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-card-border flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold text-sm" data-testid="text-recipient-name">{displayName(recipient)}</div>
                      <div className="text-xs text-muted-foreground">{recipient.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dirty && <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 rounded-full" data-testid="status-dirty">UNSAVED CHANGES</span>}
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", base.custom ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")} data-testid="status-config">
                        {base.custom ? "CUSTOM SETUP" : "DEFAULT"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {!draft.custom && (
                      <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                        No custom setup. This person currently receives the default summary ({recipient.role === "sales" ? "their own leads only" : "team-wide activity"}). Add coworkers or save to create a custom setup.
                      </p>
                    )}

                    <ol className="space-y-2" aria-label="Lead blocks in email order">
                      <li className="flex items-center gap-3 p-3 rounded-lg border border-accent/40 bg-accent/5">
                        <span className="w-6 text-xs font-mono text-muted-foreground">1</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{displayName(recipient)} <span className="text-xs text-muted-foreground font-normal">(own leads)</span></div>
                          <div className="text-[11px] text-muted-foreground">Always first. Cannot be removed or moved.</div>
                        </div>
                        <Lock className="w-4 h-4 text-muted-foreground" aria-label="Locked" />
                      </li>
                      {draft.ids.map((id, i) => {
                        const u = userMap.get(id);
                        const name = displayName(u, id);
                        return (
                          <li key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" data-testid={`row-coworker-${id}`}>
                            <span className="w-6 text-xs font-mono text-muted-foreground">{i + 2}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{name}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{u?.email ?? "No longer available"}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => move(i, -1)} disabled={i === 0 || busy} aria-label={`Move ${name} up`} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" data-testid={`button-up-${id}`}><ArrowUp className="w-4 h-4" /></button>
                              <button onClick={() => move(i, 1)} disabled={i === draft.ids.length - 1 || busy} aria-label={`Move ${name} down`} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" data-testid={`button-down-${id}`}><ArrowDown className="w-4 h-4" /></button>
                              <button onClick={() => edit((ids) => ids.filter((x) => x !== id))} disabled={busy} aria-label={`Remove ${name}`} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-30" data-testid={`button-remove-${id}`}><X className="w-4 h-4" /></button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>

                    <div className="flex gap-2">
                      <label htmlFor="add-coworker" className="sr-only">Add a sales coworker</label>
                      <select
                        id="add-coworker"
                        value={addId}
                        onChange={(e) => setAddId(e.target.value)}
                        disabled={busy || available.length === 0}
                        className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
                        data-testid="select-add-coworker"
                      >
                        <option value="">{available.length === 0 ? "No more sales reps to add" : "Add a sales rep..."}</option>
                        {available.map((u) => <option key={u.id} value={u.id}>{displayName(u)} ({u.email})</option>)}
                      </select>
                      <button
                        onClick={() => { if (addId) { edit((ids) => [...ids, addId]); setAddId(""); } }}
                        disabled={!addId || busy}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
                        data-testid="button-add-coworker"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>

                    {hasCoworkers && (
                      <div className="flex gap-2 text-xs rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-200 leading-relaxed" role="note" data-testid="text-sharing-warning">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Saving shares the selected coworkers' lead details and notes with {displayName(recipient)} by email. Make sure they should see this information.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                      <button onClick={handleSave} disabled={busy || (!dirty && base.custom)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 disabled:opacity-50" data-testid="button-save">
                        {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saveMut.isPending ? "Saving..." : "Save setup"}
                      </button>
                      <button onClick={handlePreview} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50" data-testid="button-preview">
                        {previewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        {previewMut.isPending ? "Rendering..." : "Preview email"}
                      </button>
                      {dirty && (
                        <button onClick={() => { setDraft(base); setPreview(null); }} disabled={busy} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-50" data-testid="button-discard">
                          Discard changes
                        </button>
                      )}
                      <button onClick={() => setConfirmReset(true)} disabled={busy || !base.custom} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40" data-testid="button-reset">
                        {resetMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        Reset to default
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-card border border-card-border rounded-xl overflow-hidden" aria-live="polite">
                  <div className="px-5 py-3 border-b border-card-border flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview (unsaved selection, not sent)</div>
                    {preview && !previewStale && (
                      <div className="flex text-xs rounded-lg border border-border overflow-hidden" role="tablist">
                        {(["html", "text"] as const).map((t) => (
                          <button key={t} role="tab" aria-selected={previewTab === t} onClick={() => setPreviewTab(t)} className={cn("px-2.5 py-1", previewTab === t ? "bg-muted font-semibold" : "text-muted-foreground")} data-testid={`tab-preview-${t}`}>
                            {t === "html" ? "Email" : "Plain text"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {previewMut.isPending ? (
                    <div className="p-5 space-y-2"><div className="h-4 w-1/2 bg-muted rounded animate-pulse" /><div className="h-64 bg-muted rounded animate-pulse" /></div>
                  ) : previewError ? (
                    <div className="p-5 text-sm text-destructive flex items-center justify-between gap-3" role="alert">
                      <span>Preview failed: {previewError}</span>
                      <button onClick={handlePreview} className="text-xs underline" data-testid="button-preview-retry">Try again</button>
                    </div>
                  ) : !preview ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Click Preview email to render exactly what {displayName(recipient)} would receive.</div>
                  ) : previewStale ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">The selection changed since this preview was rendered. Preview again to see the current version.</div>
                  ) : (
                    <div>
                      <div className="px-5 py-2.5 border-b border-border text-sm"><span className="text-muted-foreground text-xs mr-2">Subject</span><span className="font-medium" data-testid="text-preview-subject">{preview.data.subject}</span></div>
                      {previewTab === "html" ? (
                        <iframe title="Summary email preview" sandbox="" srcDoc={preview.data.html} className="w-full h-[560px] bg-white" data-testid="iframe-preview" />
                      ) : (
                        <pre className="p-5 text-xs whitespace-pre-wrap font-mono max-h-[560px] overflow-auto" data-testid="text-preview-plain">{preview.data.text}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingRecipient} onOpenChange={(o) => !o && setPendingRecipient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes for {displayName(recipient)}. Switching recipients will discard them. Save first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-stay">Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const id = pendingRecipient; setPendingRecipient(null); if (id) switchTo(id); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-discard-switch">
              Discard and switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default summary?</AlertDialogTitle>
            <AlertDialogDescription>
              The custom setup for {displayName(recipient)} will be removed. They will go back to {recipient?.role === "admin" || recipient?.role === "superadmin" ? "the team-wide summary" : "seeing only their own leads"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-reset">Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
