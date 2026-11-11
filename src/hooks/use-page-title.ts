import { useEffect } from "react";

const SITE_NAME = "ysocial";

/** Set the document title for the current page. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
