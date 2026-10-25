import { useEffect, useRef } from "react";
import { setUnsavedChanges } from "../lib/releaseRecovery";

export function useUnsavedChangesWarning(hasChanges: boolean) {
  const owner = useRef({});
  useEffect(() => {
    const currentOwner = owner.current;
    setUnsavedChanges(currentOwner, hasChanges);
    const handler = (e: BeforeUnloadEvent) => {
      if (!hasChanges) return;

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => {
      setUnsavedChanges(currentOwner, false);
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasChanges]);
}
