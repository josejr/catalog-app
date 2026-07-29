"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link> & {
  cookieName: string;
  cookieValue: string;
};

export function PreferenceLink({ cookieName, cookieValue, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; path=/; max-age=31536000; samesite=lax`;
        onClick?.(event);
      }}
    />
  );
}
