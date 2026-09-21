import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, MessageCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Comment {
  id: string;
  content: string;
  guestName?: string;
  createdAt: string;
  user?: { name: string };
  replies?: Comment[];
}

interface CommentResponse {
  data: Comment[];
  meta: { total: number };
}

export default function CommentsSection({ slug, count = 0 }: { slug: string; count?: number }) {
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const { data, isLoading } = useQuery<CommentResponse>({
    queryKey: ['comments', slug],
    queryFn: () => apiFetch(`/public/articles/${slug}/comments`),
  });
  const submit = useMutation({
    mutationFn: () => apiFetch(`/public/articles/${slug}/comments`, {
      method: 'POST',
      body: JSON.stringify({ guestName, content }),
    }),
    onSuccess: () => {
      setContent('');
      setMessage('Your comment is pending moderation.');
      queryClient.invalidateQueries({ queryKey: ['comments', slug] });
    },
    onError: (error: Error) => setMessage(error.message || 'Unable to submit comment.'),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!guestName.trim() || !content.trim()) return setMessage('Name and comment are required.');
    submit.mutate();
  };

  return (
    <section className="mt-12 border-t border-gray-200 pt-8" aria-labelledby="comments-heading">
      <div className="flex items-center gap-2">
        <MessageCircle size={20} className="text-primary-500" />
        <h2 id="comments-heading" className="text-xl font-bold text-gray-900">Comments ({count || data?.meta.total || 0})</h2>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 rounded-lg bg-gray-50 p-4 md:grid-cols-[minmax(0,220px)_1fr_auto] md:items-end">
        <label className="text-sm font-medium text-gray-700">Name<input value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={100} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-gray-700">Comment<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2" /></label>
        <button type="submit" disabled={submit.isPending} className="rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60">{submit.isPending ? 'Sending...' : 'Submit'}</button>
      </form>
      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
      <div className="mt-6 space-y-5">
        {isLoading && <p className="text-sm text-gray-500">Loading comments...</p>}
        {!isLoading && !data?.data.length && <p className="text-sm text-gray-500">No approved comments yet.</p>}
        {data?.data.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
      </div>
    </section>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  const [reported, setReported] = useState(false);
  const report = () => {
    apiFetch(`/public/comments/${comment.id}/report`, { method: 'POST', body: JSON.stringify({ reason: 'Reported by reader' }) }).then(() => setReported(true)).catch(() => {});
  };
  return (
    <article className="border-b border-gray-100 pb-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">{comment.user?.name || comment.guestName || 'Reader'}</p>
        <time className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleDateString()}</time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{comment.content}</p>
      <button type="button" onClick={report} disabled={reported} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"> <Flag size={12} /> {reported ? 'Reported' : 'Report'}</button>
      {comment.replies?.map((reply) => <div key={reply.id} className="ml-5 mt-4 border-l-2 border-gray-100 pl-4"><p className="text-sm font-semibold text-gray-800">{reply.user?.name || reply.guestName || 'Reader'}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{reply.content}</p></div>)}
    </article>
  );
}
