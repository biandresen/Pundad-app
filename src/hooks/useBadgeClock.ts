import { useEffect, useState } from "react";
import type { CurrentUserBadge } from "../types/context.types";
import { getCurrentBadgeValidity } from "../lib/badges";

/** Refresh mounted badge views at their next UTC validity boundary. */
export function useBadgeClock(badges?: CurrentUserBadge[]): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const now = Date.now();
    let next = Infinity;

    for (const badge of badges ?? []) {
      const { from, to } = getCurrentBadgeValidity(badge);
      for (const boundary of [from, to]) {
        if (Number.isFinite(boundary) && boundary > now) next = Math.min(next, boundary);
      }
    }

    if (!Number.isFinite(next)) return;
    const timeout = window.setTimeout(() => setRevision((value) => value + 1), Math.min(next - now, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [badges, revision]);

  return Date.now();
}
