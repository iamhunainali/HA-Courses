import { useEffect, useState } from 'react';

// Selection refresh par bhi yaad rehti hai (sessionStorage)
const read = (key: string, init: any) => { try { const v = sessionStorage.getItem(key); return v === null ? init : JSON.parse(v); } catch { return init; } };
export function useStored<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => read(key, init));
  useEffect(() => { setV(read(key, init)); }, [key]);
  const set = (x: T) => { setV(x); try { sessionStorage.setItem(key, JSON.stringify(x)); } catch {} };
  return [v, set];
}
