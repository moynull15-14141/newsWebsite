import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Globe2, Plus, Star } from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  direction: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const inputClass = 'rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';

/**
 * Site language configuration. The reader-facing switcher (apps/web) only ever offers languages that
 * are both created here AND marked active; exactly one is the default that bare (unprefixed) URLs use.
 */
export default function LanguagesPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('settings.manage');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', nativeName: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Language[]>({
    queryKey: ['languages-admin'],
    queryFn: () => apiFetch('/languages/admin/list'),
  });

  const create = useMutation({
    mutationFn: () => apiFetch('/languages', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['languages-admin'] });
      setForm({ code: '', name: '', nativeName: '' });
      setShowForm(false);
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create language')),
  });

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Pick<Language, 'isActive' | 'isDefault' | 'name' | 'nativeName' | 'sortOrder'>>) =>
      apiFetch(`/languages/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['languages-admin'] }),
    onError: (err: unknown) => alert(getApiErrorMessage(err, 'Failed to update language')),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  const languages = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><Globe2 size={22} /> Languages</h1>
          <p className="mt-1 text-sm text-gray-500">Control which languages the public site offers, and which one is the default.</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600">
            <Plus size={16} /> Add language
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mt-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-5 md:grid-cols-4">
          <label className="text-sm font-medium text-gray-700">
            Code
            <input required maxLength={8} pattern="[a-z]{2,8}" title="2-8 lowercase letters, e.g. en" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="en" className={`mt-1 block w-full ${inputClass}`} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            English name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="English" className={`mt-1 block w-full ${inputClass}`} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Native name
            <input required value={form.nativeName} onChange={(e) => setForm({ ...form, nativeName: e.target.value })} placeholder="English" className={`mt-1 block w-full ${inputClass}`} />
          </label>
          <div className="flex items-end">
            <button disabled={create.isPending} className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
          {formError && <p className="text-sm text-red-600 md:col-span-4">{formError}</p>}
          <p className="text-xs text-gray-500 md:col-span-4">New languages start inactive and are added to translation forms across Categories, Tags, Locations and Articles automatically.</p>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Language</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Code</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Active</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {languages.map((lang) => (
                <tr key={lang.id} className={lang.isActive ? '' : 'opacity-60'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lang.name}</div>
                    <div className="text-xs text-gray-500">{lang.nativeName}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{lang.code}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={lang.isActive}
                      aria-label={`${lang.isActive ? 'Disable' : 'Enable'} ${lang.name}`}
                      disabled={!canManage || update.isPending || (lang.isActive && lang.isDefault)}
                      title={lang.isActive && lang.isDefault ? 'The default language must stay active — set another language as default first.' : undefined}
                      onClick={() => update.mutate({ id: lang.id, isActive: !lang.isActive })}
                      className={`relative h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${lang.isActive ? 'bg-primary-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${lang.isActive ? 'left-[1.125rem]' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {lang.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Star size={12} className="fill-current" /> Default
                      </span>
                    ) : canManage ? (
                      <button
                        type="button"
                        disabled={update.isPending || !lang.isActive}
                        title={!lang.isActive ? 'Activate this language before making it the default.' : 'Make this the default language'}
                        onClick={() => update.mutate({ id: lang.id, isDefault: true })}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Check size={12} /> Set default
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
