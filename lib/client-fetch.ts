/** 같은 키의 진행 중 fetch를 한 번만 실행 (마운트 중복·형제 컴포넌트 공유). */
const inflight = new Map<string, Promise<unknown>>();

export function sharedJson<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit) return hit as Promise<T>;
  const pending = loader().finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}
