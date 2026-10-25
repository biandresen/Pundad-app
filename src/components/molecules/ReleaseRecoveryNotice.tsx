import { useSyncExternalStore } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { hasUnsavedChanges, recoveryStore, reloadPage } from "../../lib/releaseRecovery";

export default function ReleaseRecoveryNotice() {
  const state = useSyncExternalStore(recoveryStore.subscribe, recoveryStore.getSnapshot);
  const { t } = useLanguage();
  if (!state) return null;
  const dirty = state.reason === "unsaved" || hasUnsavedChanges();
  return (
    <div role="alert" className="fixed bottom-4 left-4 right-4 z-[100] rounded-lg border bg-[var(--bg)] text-[var(--text0)] p-4 shadow-lg">
      <p>{t("releaseRecovery.failed")}</p>
      <p>{t(dirty ? "releaseRecovery.unsaved" : state.reason === "offline" ? "releaseRecovery.offline" : "releaseRecovery.retryHint")}</p>
      <div className="flex gap-4 mt-2">
        <button type="button" onClick={state.retry}>{t("releaseRecovery.retry")}</button>
        <button type="button" onClick={() => { window.history.back(); }}>{t("releaseRecovery.back")}</button>
        {!dirty && <button type="button" onClick={reloadPage}>{t("releaseRecovery.reload")}</button>}
      </div>
    </div>
  );
}
