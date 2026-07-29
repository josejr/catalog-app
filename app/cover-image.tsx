"use client";

import { useRef } from "react";

export function CoverImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${className} cursor-zoom-in`}
        onClick={() => dialogRef.current?.showModal()}
      />
      <dialog
        ref={dialogRef}
        className="bg-transparent p-0 m-auto max-w-[90vw] max-h-[90vh] backdrop:bg-black/70"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-neutral-800 shadow flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      </dialog>
    </>
  );
}
