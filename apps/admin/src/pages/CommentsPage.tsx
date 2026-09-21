import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flag, MessageCircle, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Comment { id: string; content: string; status: string; guestName?: string; createdAt: string; article?: { title: string }; user?: { name: string } }
interface Response { data: Comment[]; meta: { total: number } }
const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'SPAM', 'DELETED'];

export default function CommentsPage() {
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<Response>({ queryKey: ['admin-comments', status, search], queryFn: () => apiFetch(`/comments?status=${status}&search=${encodeURIComponent(search)}`) });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => type === 'delete' ? apiFetch(`/comments/${id}`, { method: 'DELETE' }) : apiFetch(`/comments/${id}/${type}`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-comments'] }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><MessageCircle size={22} /> Comments</h1><p className="mt-1 text-sm text-gray-500">Review reader comments before publication.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments" className="rounded border border-gray-300 px-3 py-2 text-sm" /></div>
      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-gray-200">{statuses.map((item) => <button key={item} onClick={() => setStatus(item)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${status === item ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'}`}>{item[0] + item.slice(1).toLowerCase()}</button>)}</div>
      <div className="mt-4 space-y-3">{isLoading && <p className="text-sm text-gray-500">Loading comments...</p>}{!isLoading && !data?.data.length && <p className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No comments in this queue.</p>}{data?.data.map((comment) => <article key={comment.id} className="rounded-lg border border-gray-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{comment.user?.name || comment.guestName || 'Guest'}</p><p className="text-xs text-gray-500">{comment.article?.title || 'Unknown article'} · {new Date(comment.createdAt).toLocaleString()}</p></div><span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">{comment.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{comment.content}</p><div className="mt-4 flex flex-wrap gap-2">{status === 'PENDING' && <><button onClick={() => action.mutate({ id: comment.id, type: 'approve' })} className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"><Check size={14} /> Approve</button><button onClick={() => action.mutate({ id: comment.id, type: 'reject' })} className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"><X size={14} /> Reject</button><button onClick={() => action.mutate({ id: comment.id, type: 'spam' })} className="inline-flex items-center gap-1 rounded border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-700"><Flag size={14} /> Spam</button></>}<button onClick={() => window.confirm('Delete this comment?') && action.mutate({ id: comment.id, type: 'delete' })} className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={14} /> Delete</button></div></article>)}</div>
    </div>
  );
}
