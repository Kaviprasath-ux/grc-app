"use client";

import { useState, type ReactNode } from "react";

interface TemplateCoverImageProps {
  /** Stored cover-image URL, e.g. "/uploads/artifacts/foo.png". */
  src?: string | null;
  alt: string;
  /** Classes applied to the <img> when it renders. */
  className?: string;
  /** Rendered when there is no image, or when the stored URL fails to load. */
  fallback: ReactNode;
}

/**
 * Cover image for a questionnaire template, with a fallback that also covers
 * the "URL is set but the file is gone" case.
 *
 * Why this exists: uploads are stored as relative paths ("/uploads/...") and
 * served by /api/uploads/[...path]. When the storage driver falls back to
 * local disk (no SPACES_* env vars), the container filesystem is ephemeral —
 * a redeploy deletes the bytes while the DB row keeps pointing at the old
 * path, so the request 404s. A bare <img> paints a broken-image box in that
 * situation, which reads as a broken page rather than a missing picture.
 * Failing over to the same placeholder used for "no image set" keeps the UI
 * honest either way.
 *
 * The failed URL is tracked (rather than a boolean) so that replacing the
 * image re-attempts the load instead of staying stuck on the placeholder.
 */
export function TemplateCoverImage({ src, alt, className, fallback }: TemplateCoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- uploads are served
    // through our own route, not an optimizable static/CDN asset.
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
