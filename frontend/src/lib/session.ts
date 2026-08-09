import type { DomainResult, TestId } from "./types";

const K = "nl_session_domains";

/** Save one completed test's domain result for the current screening session. */
export function saveSessionResult(domain: DomainResult): void {
  const all = getSessionResults().filter((d) => d.id !== domain.id);
  all.push(domain);
  sessionStorage.setItem(K, JSON.stringify(all));
}

export function getSessionResults(): DomainResult[] {
  try {
    const raw = sessionStorage.getItem(K);
    return raw ? (JSON.parse(raw) as DomainResult[]) : [];
  } catch {
    return [];
  }
}

export function hasSessionResult(id: TestId): boolean {
  return getSessionResults().some((d) => d.id === id);
}

export function clearSession(): void {
  sessionStorage.removeItem(K);
}
