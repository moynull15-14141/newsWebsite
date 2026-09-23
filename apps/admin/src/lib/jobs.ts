/**
 * Pure, framework-free helpers for the Admin Jobs list/editor — same split as lib/articles.ts (logic
 * here, components stay thin) so the query-building and workflow-action rules are unit-testable
 * without rendering React or mocking fetch.
 */

export interface JobListFilters {
  page: number;
  limit?: number;
  search?: string;
  status?: string;
  categoryId?: string;
  employerId?: string;
  locationId?: string;
  featured?: boolean;
}

/** Builds the `/jobs` list query string. Empty/blank filters are omitted rather than sent as `=`. */
export function buildJobListQuery(filters: JobListFilters): string {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit ?? 20));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.employerId) params.set('employerId', filters.employerId);
  if (filters.locationId) params.set('locationId', filters.locationId);
  if (filters.featured !== undefined) params.set('featured', String(filters.featured));
  return `/jobs?${params.toString()}`;
}

export interface WorkflowJob {
  status: string;
  createdBy?: { id: string };
}

export type JobAction =
  | 'edit' | 'submit-review' | 'approve' | 'return-to-draft'
  | 'publish' | 'schedule' | 'cancel-schedule' | 'archive' | 'delete'
  | 'feature' | 'unfeature';

export interface JobActionSpec {
  label: string;
  action: JobAction;
}

/**
 * The set of workflow actions available for a job, given the viewer's permissions and identity —
 * mirrors JobsController/JobsService exactly (same "only decides what to show, server re-checks
 * everything" posture as getArticleActions in lib/articles.ts).
 */
export function getJobActions(job: WorkflowJob, hasPermission: (permission: string) => boolean, currentUserId?: string): JobActionSpec[] {
  const actions: JobActionSpec[] = [];

  if (hasPermission('job.edit')) actions.push({ label: 'Edit', action: 'edit' });

  if (job.status === 'DRAFT' && ((!!currentUserId && job.createdBy?.id === currentUserId) || hasPermission('job.publish'))) {
    actions.push({ label: 'Submit Review', action: 'submit-review' });
  }
  if (job.status === 'IN_REVIEW' && hasPermission('job.review')) {
    actions.push({ label: 'Approve', action: 'approve' });
    actions.push({ label: 'Return to Draft', action: 'return-to-draft' });
  }
  if (job.status === 'APPROVED') {
    if (hasPermission('job.review')) actions.push({ label: 'Return to Draft', action: 'return-to-draft' });
    if (hasPermission('job.publish')) {
      actions.push({ label: 'Publish', action: 'publish' });
      actions.push({ label: 'Schedule', action: 'schedule' });
    }
  }
  if (job.status === 'SCHEDULED' && hasPermission('job.publish')) {
    actions.push({ label: 'Cancel Schedule', action: 'cancel-schedule' });
  }
  if (['PUBLISHED', 'EXPIRED'].includes(job.status) && hasPermission('job.publish')) {
    actions.push({ label: 'Archive', action: 'archive' });
  }
  if (job.status === 'PUBLISHED' && hasPermission('job.publish')) {
    actions.push({ label: 'Feature', action: 'feature' });
  }
  if (job.status === 'DRAFT' || job.status === 'ARCHIVED') {
    if (hasPermission('job.delete')) actions.push({ label: 'Delete', action: 'delete' });
  }
  return actions;
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', IN_REVIEW: 'In Review', APPROVED: 'Approved', SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published', EXPIRED: 'Expired', ARCHIVED: 'Archived',
};

export const JOB_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-orange-100 text-orange-700',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export function formatSalary(min?: number | null, max?: number | null, currency?: string | null, negotiable?: boolean): string {
  if (negotiable && !min && !max) return 'Negotiable';
  const cur = currency || 'BDT';
  if (min && max) return `${cur} ${min.toLocaleString()} - ${max.toLocaleString()}`;
  if (min) return `${cur} ${min.toLocaleString()}+`;
  if (max) return `Up to ${cur} ${max.toLocaleString()}`;
  return 'Not disclosed';
}
