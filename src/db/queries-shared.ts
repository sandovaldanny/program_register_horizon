import type { Center, Clinician } from "./schema";

/** Active catalogue names by specialty, optionally restricted to one center (plus shared ones). Client-safe. */
export function catalogNames(list: Clinician[], specialty: Clinician["specialty"], center?: Center | null): string[] {
  return list
    .filter((c) => c.active && c.specialty === specialty && (!center || !c.center || c.center === center))
    .map((c) => c.name);
}
