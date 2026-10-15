/** Tiny class joiner; no tailwind-merge needed at this size. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
