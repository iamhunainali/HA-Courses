export default function Progress({ pct, label }: { pct: number | null; label?: string }) {
  if (pct === null) return null;
  return (
    <div className="progress">
      <div className="bar"><div style={{ width: pct + '%' }} /></div>
      <span>{label || 'Uploading'} {pct}%{pct === 100 ? ' – processing…' : ''}</span>
    </div>
  );
}
