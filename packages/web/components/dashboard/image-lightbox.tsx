'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface LightboxImage {
  url: string;
  title: string;
}

/**
 * A single-image lightbox with a caption bar — the same shape as the workflow step lightbox, for
 * surfaces that expand ONE picture (a recording's thumbnail, a captured-action screenshot) rather
 * than walk a step list. Extracted at the second consumer.
 */
export function ImageLightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={image !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[80vw] gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        {image && (
          <>
            <div className="border-b border-brand-100 bg-brand-50 px-5 py-3.5 pr-12">
              <DialogTitle className="truncate text-[15px] font-semibold text-ink">
                {image.title}
              </DialogTitle>
            </div>
            <div className="min-w-0 bg-[color:var(--paper-2)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL */}
              <img
                src={image.url}
                alt={image.title}
                className="mx-auto block max-h-[75vh] w-auto max-w-full rounded-lg border bg-media object-contain"
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
