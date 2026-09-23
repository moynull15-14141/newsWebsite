import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';

export default function BookmarkButton({ articleId }: { articleId: string }) {
  const navigate = useNavigate(); const user = useReaderAuthStore((s) => s.user); const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) { setSaved(false); return; }
    apiFetch<{ saved: boolean }>(`/reader/bookmarks/${articleId}`).then((result) => setSaved(result.saved)).catch(() => {});
  }, [articleId, user]);
  const toggle = async () => { if (!user) return navigate('/login'); setBusy(true); try { if (saved) await apiFetch(`/reader/bookmarks/${articleId}`, { method: 'DELETE' }); else await apiFetch(`/reader/bookmarks/${articleId}`, { method: 'POST' }); setSaved(!saved); } finally { setBusy(false); } };
  return <button onClick={toggle} disabled={busy} className="inline-flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save article'}</button>;
}
