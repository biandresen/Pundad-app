type RecoveryReason = "checking" | "offline" | "unavailable" | "current" | "attempted" | "storage" | "unsaved";
type Recovery = { reason: RecoveryReason; retry: () => void };

let recovery: Recovery | null = null;
const listeners = new Set<() => void>();
const dirtyOwners = new Set<object>();
const editedFields = new Set<Element>();
const guardKey = "pundad:chunk-recovery";

function publish(value: Recovery | null) {
  recovery = value;
  listeners.forEach((listener) => listener());
}

export const recoveryStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot: () => recovery,
};

export function setUnsavedChanges(owner: object, dirty: boolean) {
  if (dirty) dirtyOwners.add(owner);
  else dirtyOwners.delete(owner);
}

export function trackEditedFields() {
  // Covers editors without the beforeunload hook as well as pending draft autosaves.
  document.addEventListener("input", (event) => {
    if (event.target instanceof Element && event.target.matches("input, textarea, select, [contenteditable]")) {
      editedFields.add(event.target);
    }
  }, true);
}

export function hasUnsavedChanges() {
  for (const field of editedFields) {
    if (!field.isConnected) editedFields.delete(field);
  }
  return dirtyOwners.size > 0 || editedFields.size > 0;
}

function isImportFailure(error: unknown) {
  return error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(error.message);
}

async function recover(retry: () => void) {
  const href = window.location.href;
  const show = (reason: RecoveryReason) => {
    if (window.location.href === href) publish({ reason, retry });
  };
  show("checking");
  if (!navigator.onLine) return show("offline");
  try {
    const response = await fetch("/__build.json", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return show("unavailable");
    const metadata: { buildId?: unknown } = await response.json();
    if (window.location.href !== href) return;
    if (typeof metadata.buildId !== "string" || !/^[a-z0-9-]{16,80}$/i.test(metadata.buildId)) return show("unavailable");
    if (metadata.buildId === __APP_BUILD_ID__) return show("current");
    if (hasUnsavedChanges()) return show("unsaved");
    try {
      // Deliberately survives reloads and remounts. A new tab gets a new recovery budget.
      if (sessionStorage.getItem(guardKey)) return show("attempted");
      sessionStorage.setItem(guardKey, metadata.buildId);
      if (sessionStorage.getItem(guardKey) !== metadata.buildId) return show("storage");
    } catch {
      return show("storage");
    }
    window.location.reload();
  } catch {
    show(navigator.onLine ? "unavailable" : "offline");
  }
}

// Keep the lazy component pending on delivery failures. Rejecting it into an error
// boundary would unmount editors before the user can save their work.
export async function importWithRecovery<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isImportFailure(error)) throw error;
    return new Promise<T>((resolve, reject) => {
      const retry = async () => {
        try {
          const module = await load();
          publish(null);
          resolve(module);
        } catch (nextError) {
          if (!isImportFailure(nextError)) {
            publish(null);
            reject(nextError);
          } else {
            await recover(retry);
          }
        }
      };
      void recover(retry);
    });
  }
}

export function reloadPage() {
  // Explicit user action can retry even when browser storage is unavailable.
  // Existing native beforeunload handlers still protect unsaved drafts.
  if (!hasUnsavedChanges()) window.location.reload();
}
