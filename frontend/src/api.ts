export const token = () => localStorage.getItem('token');
export const media = (f?: string | null) => (f ? `/api/media/${f}` : '');

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const h: any = {};
  const t = token();
  if (t) h.Authorization = 'Bearer ' + t;
  let body: any;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body) { h['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const r = await fetch('/api' + path, { method: opts.method || 'GET', headers: h, body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (d.code === 'SUSPENDED') window.dispatchEvent(new CustomEvent('suspended', { detail: d }));   // warning popup
    const e: any = new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Something went wrong');
    e.status = r.status; e.data = d;
    throw e;
  }
  return d;
}

// Upload with live percentage
export function upload(path: string, form: FormData, method: string, onProgress: (n: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, '/api' + path);
    x.setRequestHeader('Authorization', 'Bearer ' + token());
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let d: any = {};
      try { d = JSON.parse(x.responseText); } catch {}
      x.status < 300 ? resolve(d) : reject(new Error(d.message || 'Upload failed'));
    };
    x.onerror = () => reject(new Error('Network error'));
    x.send(form);
  });
}
