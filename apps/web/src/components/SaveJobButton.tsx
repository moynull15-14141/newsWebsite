import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import { useLanguage } from '@/lib/i18n';

/** Mirrors BookmarkButton exactly — same pattern, saved-jobs endpoints instead of bookmarks. */
export default function SaveJobButton({ jobId }: { jobId: string }) {
  const navigate = useNavigate();
  const { code, pathFor, t } = useLanguage();
  const user = useReaderAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) { setSaved(false); return; }
    apiFetch<{ saved: boolean }>(`/reader/saved-jobs/${jobId}`).then((result) => setSaved(result.saved)).catch(() => {});
  }, [jobId, user]);

  const toggle = async () => {
    if (!user) return navigate(pathFor('/login', code));
    setBusy(true);
    try {
      if (saved) await apiFetch(`/reader/saved-jobs/${jobId}`, { method: 'DELETE' });
      else await apiFetch(`/reader/saved-jobs/${jobId}`, { method: 'POST' });
      setSaved(!saved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className="inline-flex items-center gap-2 rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
    >
      <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
      {saved ? t('jobs.saved') : t('jobs.saveJob')}
    </button>
  );
}
