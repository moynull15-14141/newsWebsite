/* eslint-disable react-refresh/only-export-components -- colocates the small context + its hook, mirroring lib/i18n.tsx's justification for the same pattern. */
import { createContext, useContext } from 'react';
import type { MyMembership } from './types';

/** The caller's own active/invited employer membership, resolved once by `EmployerLayout` and passed down
 * so every `/employer/*` page (and especially Team's privilege-escalation UI gating) can read the caller's
 * own role without re-fetching `/employer-portal/me` itself. */
export const EmployerMembershipContext = createContext<MyMembership | null>(null);

export function useEmployerMembership(): MyMembership {
  const ctx = useContext(EmployerMembershipContext);
  if (!ctx) throw new Error('useEmployerMembership must be used within EmployerLayout');
  return ctx;
}
