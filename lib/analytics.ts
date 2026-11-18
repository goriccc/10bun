type Params = Record<string, string | number | boolean | null | undefined>;

export function track(name: string, params: Params = {}): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value != null) clean[key] = value;
  }
  gtag('event', name, clean);
}
