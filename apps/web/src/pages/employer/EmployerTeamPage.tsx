import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { useEmployerMembership } from './EmployerContext';
import type { EmployerMember, MembershipRole } from './types';

const ALL_ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'RECRUITER'];

export default function EmployerTeamPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const membership = useEmployerMembership();
  const isOwner = membership.role === 'OWNER';
  const canManage = membership.role === 'OWNER' || membership.role === 'ADMIN';

  const { data: members, isLoading, isError } = useQuery<EmployerMember[]>({
    queryKey: ['employer-members'],
    queryFn: () => apiFetch('/employer-portal/members'),
  });

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('RECRUITER');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => apiFetch('/employer-portal/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employer-members'] }); setEmail(''); setRole('RECRUITER'); setInviteError(null); },
    onError: (err: unknown) => setInviteError(getApiErrorMessage(err, t('employer.team.inviteError'))),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role: newRole }: { id: string; role: MembershipRole }) => apiFetch(`/employer-portal/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer-members'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/employer-portal/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer-members'] }),
  });

  // Client-side mirror of the server's privilege-escalation guards (EmployerPortalService.updateMemberRole/
  // removeMember): only an OWNER may grant/change OWNER or touch another OWNER's role; a non-owner ADMIN
  // can't remove another ADMIN. The server is what actually enforces this — this only keeps the UI from
  // offering an action every non-owner caller would just get a 403 back for.
  function rolesFor(member: EmployerMember): MembershipRole[] {
    if (isOwner) return ALL_ROLES;
    if (member.role === 'OWNER') return [];
    return ALL_ROLES.filter((r) => r !== 'OWNER');
  }
  function canRemove(member: EmployerMember): boolean {
    if (member.id === membership.id) return false;
    if (member.role === 'OWNER') return isOwner;
    if (member.role === 'ADMIN') return isOwner;
    return canManage;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900">{t('employer.team.title')}</h1>

      {isLoading ? (
        <p className="mt-6 text-neutral-500">{t('common.loading')}</p>
      ) : isError || !members ? (
        <p className="mt-6 text-red-600">{t('common.somethingWrong')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.team.colName')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.team.colRole')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.team.colStatus')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-500">{t('employer.team.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {members.map((m) => {
                const roleOptions = rolesFor(m);
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-neutral-900">{m.user.name}</p>
                      <p className="text-neutral-500">{m.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {roleOptions.length > 0 ? (
                        <label className="sr-only" htmlFor={`role-${m.id}`}>{t('employer.team.colRole')}</label>
                      ) : null}
                      {roleOptions.length > 0 ? (
                        <select
                          id={`role-${m.id}`}
                          value={m.role}
                          onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value as MembershipRole })}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                        >
                          {roleOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
                        </select>
                      ) : (
                        <span>{m.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{m.status}</td>
                    <td className="px-4 py-3 text-right">
                      {canRemove(m) && (
                        <button
                          onClick={() => { if (confirm(t('employer.team.confirmRemove'))) remove.mutate(m.id); }}
                          className="text-sm text-red-600 hover:underline"
                          aria-label={`${t('employer.team.remove')} ${m.user.name}`}
                        >
                          {t('employer.team.remove')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <section className="mt-8 max-w-md rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{t('employer.team.invite')}</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => { e.preventDefault(); setInviteError(null); if (email.trim()) invite.mutate(); }}
          >
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-neutral-700">{t('employer.team.email')}</label>
              <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-neutral-700">{t('employer.team.role')}</label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as MembershipRole)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
                {(isOwner ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'OWNER')).map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            {inviteError && <p role="alert" className="text-sm text-red-600">{inviteError}</p>}
            <button type="submit" disabled={invite.isPending} className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
              {t('employer.team.sendInvite')}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
