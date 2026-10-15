"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", key: "dashboard" },
  { href: "/patients", key: "patients" },
  { href: "/settings", key: "settings" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <>
      {LINKS.map(({ href, key }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-control px-3 py-2.5 text-sm transition-colors",
              active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </>
  );
}
