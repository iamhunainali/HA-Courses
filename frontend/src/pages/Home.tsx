import { useEffect, useState } from 'react';
import { api } from '../api';
import { DEFAULT_SECTIONS } from '../homeDefaults';
import Sections from '../components/Sections';

// Homepage admin ke "Homepage" builder se banta hai. Kuch save na ho to default layout dikhta hai.
export default function Home() {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    api('/sections')
      .then((r) => setList(r.configured ? r.sections : DEFAULT_SECTIONS))
      .catch(() => setList(DEFAULT_SECTIONS));
  }, []);
  if (!list) return <div className="page">Loading…</div>;
  return <Sections list={list} />;
}
