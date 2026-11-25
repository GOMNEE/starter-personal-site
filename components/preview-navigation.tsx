"use client";

import { useEffect } from "react";

/**
 * Inside Gomnee's preview frame, real site links open in a new tab, while the
 * Article's own contents links (#…) keep the preview in place.
 */
export function PreviewNavigation() {
  useEffect(() => {
    const follow = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      const link = (event.target as Element).closest?.<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const target = new URL(link.href, location.href);
      if (
        target.origin === location.origin &&
        target.pathname === location.pathname &&
        target.search === location.search &&
        target.hash
      )
        return;
      event.preventDefault();
      window.open(target.href, "_blank", "noopener,noreferrer");
    };
    // Capture runs before Next's Link handler would replace the private page.
    document.addEventListener("click", follow, true);
    return () => document.removeEventListener("click", follow, true);
  }, []);
  return null;
}
