/** Shared response shapes for the `/employer-portal/*` endpoints, used across every page in this folder.
 * These are intentionally loose (fields the UI actually reads) rather than a 1:1 mirror of the Prisma
 * models — the backend is the source of truth for validation, this is just enough typing for the UI. */

export interface EmployerSummary {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isSelfService?: boolean;
}

export type MembershipRole = 'OWNER' | 'ADMIN' | 'RECRUITER';
export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

export interface MyMembership {
  id: string;
  employerId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  employer: EmployerSummary;
}

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  description: string | null;
  industry: string | null;
  companySize: string | null;
  foundedYear: number | null;
  locationId: string | null;
  location?: { id: string; name: string } | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote?: string | null;
  logo?: { publicUrl: string } | null;
  cover?: { publicUrl: string } | null;
}

export interface DashboardSummary {
  employerStatus: string | null;
  verificationStatus: string | null;
  jobsByStatus: Record<string, number>;
  totalJobs: number;
  totalApplications: number;
}

export type JobStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED' | 'EXPIRED' | 'ARCHIVED';

export interface EmployerJobListItem {
  id: string;
  title: string;
  slug: string;
  status: JobStatus;
  employmentType: string;
  workplaceType: string;
  deadline: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string } | null;
  _count?: { applications: number };
}

export interface EmployerJobDetail {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: unknown;
  responsibilities: unknown;
  requirements: unknown;
  qualifications: unknown;
  experience: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryNegotiable: boolean;
  employmentType: string;
  workplaceType: string;
  vacancies: number | null;
  categoryId: string;
  locationId: string | null;
  applicationMethod: string;
  externalApplyUrl: string | null;
  applicationEmail: string | null;
  applicationInstructions: string | null;
  deadline: string | null;
  status: JobStatus;
  category?: { id: string; name: string };
  location?: { id: string; name: string } | null;
  _count?: { applications: number };
}

export interface EmployerApplicationListItem {
  id: string;
  status: string;
  method: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: { id: string; name: string; email: string };
  job: { id: string; title: string; slug: string };
  resume: { id: string; fileName: string; publicUrl: string } | null;
  reviewedBy: { id: string; name: string } | null;
}

export interface EmployerApplicationDetail extends EmployerApplicationListItem {
  coverLetter: string | null;
  job: { id: string; title: string; slug: string; status: string };
}

export interface EmployerMember {
  id: string;
  employerId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  user: { id: string; name: string; email: string };
  invitedBy?: { id: string; name: string } | null;
}

export interface JobPostingPlan {
  id: string;
  key: string;
  name: string;
  type: 'FREE' | 'PAID';
  priceAmount: number | null;
  priceCurrency: string | null;
  durationDays: number;
  isFeatured: boolean;
  available: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface JobCategoryOption { id: string; name: string }
export interface LocationOption { id: string; name: string; type: string }

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'] as const;
export const WORKPLACE_TYPES = ['ON_SITE', 'REMOTE', 'HYBRID'] as const;
export const APPLICATION_METHODS = ['INTERNAL', 'EXTERNAL_URL', 'EMAIL'] as const;

export function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}
