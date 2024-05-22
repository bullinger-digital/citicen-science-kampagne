"use client";
// Source: https://github.com/vercel/next.js/discussions/41934#discussioncomment-8996669
import { startTransition } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useIsBlocked } from "./navigation-block";
import React from "react";

/**
 * A custom Link component that wraps Next.js's next/link component.
 */
export function Link({
  href,
  children,
  replace,
  onClick,
  ...rest
}: Parameters<typeof NextLink>[0]) {
  const router = useRouter();
  const isBlocked = useIsBlocked();

  return (
    <NextLink
      href={href}
      onClick={(e) => {
        const navigate = () => {
          onClick ? onClick(e) : null;

          if (href.toString()) {
            if (rest.target === "_blank") {
              // Open in new tab
              window.open(href.toString(), "_blank");
              return;
            }
            startTransition(() => {
              const url = href.toString();
              if (replace) {
                router.replace(url);
              } else {
                router.push(url);
              }
            });
          }
        };

        if (rest.target === "_blank" || e.button !== 0) {
          navigate();
          return;
        }

        e.preventDefault();

        // Cancel navigation
        if (
          isBlocked &&
          !window.confirm(
            "Sie haben ungespeicherte Änderungen. Wollen Sie wirklich fortfahren?"
          )
        ) {
          return;
        }

        navigate();
      }}
      {...rest}
    >
      {children}
    </NextLink>
  );
}
