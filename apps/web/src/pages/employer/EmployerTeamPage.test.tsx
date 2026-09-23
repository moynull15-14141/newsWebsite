import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EmployerTeamPage from './EmployerTeamPage';
import { LanguageProvider } from '@/lib/i18n';
import { EmployerMembershipContext } from './EmployerContext';
import type { EmployerMember, MyMembership } from './types';

vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/en/employer/team', search: '' }) }));

let members: EmployerMember[];
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: members, isLoading: false, isError: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function ownerMembership(): MyMembership {
  return { id: 'm-owner', employerId: 'e1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE', employer: { id: 'e1', name: 'Acme', slug: 'acme', status: 'ACTIVE', verificationStatus: 'VERIFIED' } };
}
function adminMembership(): MyMembership {
  return { id: 'm-admin', employerId: 'e1', userId: 'u-admin', role: 'ADMIN', status: 'ACTIVE', employer: { id: 'e1', name: 'Acme', slug: 'acme', status: 'ACTIVE', verificationStatus: 'VERIFIED' } };
}

function renderAs(caller: MyMembership) {
  return renderToStaticMarkup(
    <LanguageProvider>
      <EmployerMembershipContext.Provider value={caller}>
        <EmployerTeamPage />
      </EmployerMembershipContext.Provider>
    </LanguageProvider>,
  );
}

describe('EmployerTeamPage — privilege-escalation UI gating', () => {
  it('lets an OWNER offer the OWNER role when inviting', () => {
    members = [{ id: 'm-owner', employerId: 'e1', userId: 'u-owner', role: 'OWNER', status: 'ACTIVE', user: { id: 'u-owner', name: 'Owner Person', email: 'owner@example.com' } }];
    const markup = renderAs(ownerMembership());
    expect(markup).toContain('<option value="OWNER">OWNER</option>');
  });

  it('never offers the OWNER role to a non-owner ADMIN inviting a new member', () => {
    members = [{ id: 'm-admin', employerId: 'e1', userId: 'u-admin', role: 'ADMIN', status: 'ACTIVE', user: { id: 'u-admin', name: 'Admin Person', email: 'admin@example.com' } }];
    const markup = renderAs(adminMembership());
    expect(markup).not.toContain('<option value="OWNER">OWNER</option>');
  });

  it('does not let an ADMIN change another OWNER’s role from the table', () => {
    members = [
      { id: 'm-admin', employerId: 'e1', userId: 'u-admin', role: 'ADMIN', status: 'ACTIVE', user: { id: 'u-admin', name: 'Admin Person', email: 'admin@example.com' } },
      { id: 'm-owner2', employerId: 'e1', userId: 'u-owner2', role: 'OWNER', status: 'ACTIVE', user: { id: 'u-owner2', name: 'Other Owner', email: 'owner2@example.com' } },
    ];
    const markup = renderAs(adminMembership());
    // The other owner's row should show a plain role label, not an editable <select>.
    expect(markup).toContain('Other Owner');
    expect(markup).not.toContain('id="role-m-owner2"');
  });
});
