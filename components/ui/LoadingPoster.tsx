"use client";

interface LoadingPosterProps {
  src: string;
  alt: string;
  progress: number;
  visible: boolean;
  label: string;
}

/** Poster image shown instantly; fades out when the model is ready. */
export function LoadingPoster({ src, alt, progress, visible, label }: LoadingPosterProps) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- poster URLs may be off-site (R2) */}
      <img src={src} alt={alt} className="h-full w-full object-contain p-[8%] opacity-70 blur-[1px]" draggable={false} />
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-[#F17423] transition-[width] duration-200" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
        <span className="text-[11px] tracking-wide text-gray-600 uppercase">{label}</span>
      </div>
    </div>
  );
}
