import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import RichTextEditor from '../components/RichTextEditor';
import { Briefcase, Save } from 'lucide-react';

interface JobCategoryOption { id: string; name: string }
interface EmployerOption { id: string; name: string }
interface LocationOption { id: string; name: string; type: string }

interface JobDetail {
  id: string; title: string; slug: string; summary: string | null; description: unknown;
  responsibilities: unknown; requirements: unknown; qualifications: unknown; experience: string | null;
  salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null; salaryNegotiable: boolean;
  employmentType: string; workplaceType: string; vacancies: number | null;
  categoryId: string; employerId: string; locationId: string | null;
  applicationMethod: string; externalApplyUrl: string | null; applicationEmail: string | null; applicationInstructions: string | null;
  deadline: string | null; status: string; updatedAt: string;
}

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY', 'FREELANCE'];
const WORKPLACE_TYPES = ['ON_SITE', 'REMOTE', 'HYBRID'];
const APPLICATION_METHODS = ['INTERNAL', 'EXTERNAL_URL', 'EMAIL'];

/** Plain textarea's own JSON string turned into a minimal TipTap doc, so `responsibilities`/
 *  `requirements`/`qualifications` still store the same Json shape the public renderer expects, without
 *  needing three more full RichTextEditor instances on this form (Part 6 — reuse, don't duplicate the
 *  article editor's full richness for fields that are realistically short bullet lists). */
function textToDoc(text: string): unknown {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return undefined;
  return { type: 'doc', content: lines.map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) };
}
interface TiptapTextNode { text?: string }
interface TiptapDocNode { content?: TiptapTextNode[] }

function docToText(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || !Array.isArray((doc as { content?: unknown }).content)) return '';
  return ((doc as { content: TiptapDocNode[] }).content)
    .map((node) => (node.content || []).map((n) => n.text || '').join(''))
    .join('\n');
}

export default function JobEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: job } = useQuery<JobDetail>({ queryKey: ['job', id], queryFn: () => apiFetch(`/jobs/${id}`), enabled: isEdit });
  const { data: categories = [] } = useQuery<JobCategoryOption[]>({ queryKey: ['job-categories', 'all'], queryFn: () => apiFetch('/job-categories?includeInactive=true') });
  const { data: employersResp } = useQuery<{ data: EmployerOption[] }>({ queryKey: ['employers', 'all'], queryFn: () => apiFetch('/employers?limit=100') });
  const { data: locations = [] } = useQuery<LocationOption[]>({ queryKey: ['locations', 'all'], queryFn: () => apiFetch('/locations?all=true') });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [requirements, setRequirements] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experience, setExperience] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryNegotiable, setSalaryNegotiable] = useState(false);
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [workplaceType, setWorkplaceType] = useState('ON_SITE');
  const [vacancies, setVacancies] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [applicationMethod, setApplicationMethod] = useState('INTERNAL');
  const [externalApplyUrl, setExternalApplyUrl] = useState('');
  const [applicationEmail, setApplicationEmail] = useState('');
  const [applicationInstructions, setApplicationInstructions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    setTitle(job.title); setSummary(job.summary || '');
    setDescription(typeof job.description === 'string' ? job.description : job.description ? JSON.stringify(job.description) : '');
    setResponsibilities(docToText(job.responsibilities)); setRequirements(docToText(job.requirements)); setQualifications(docToText(job.qualifications));
    setExperience(job.experience || ''); setSalaryMin(job.salaryMin?.toString() || ''); setSalaryMax(job.salaryMax?.toString() || '');
    setSalaryNegotiable(job.salaryNegotiable); setEmploymentType(job.employmentType); setWorkplaceType(job.workplaceType);
    setVacancies(job.vacancies?.toString() || '1'); setCategoryId(job.categoryId); setEmployerId(job.employerId); setLocationId(job.locationId || '');
    setApplicationMethod(job.applicationMethod); setExternalApplyUrl(job.externalApplyUrl || ''); setApplicationEmail(job.applicationEmail || '');
    setApplicationInstructions(job.applicationInstructions || ''); setDeadline(job.deadline ? job.deadline.slice(0, 10) : '');
  }, [job]);

  const buildPayload = () => ({
    title,
    summary: summary || undefined,
    description: description ? JSON.parse(description) : undefined,
    responsibilities: textToDoc(responsibilities),
    requirements: textToDoc(requirements),
    qualifications: textToDoc(qualifications),
    experience: experience || undefined,
    salaryMin: salaryMin ? Number(salaryMin) : undefined,
    salaryMax: salaryMax ? Number(salaryMax) : undefined,
    salaryNegotiable,
    employmentType,
    workplaceType,
    vacancies: vacancies ? Number(vacancies) : undefined,
    categoryId,
    employerId,
    locationId: locationId || undefined,
    applicationMethod,
    externalApplyUrl: applicationMethod === 'EXTERNAL_URL' ? externalApplyUrl : undefined,
    applicationEmail: applicationMethod === 'EMAIL' ? applicationEmail : undefined,
    applicationInstructions: applicationInstructions || undefined,
    deadline: deadline ? new Date(deadline).toISOString() : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch<JobDetail>('/jobs', { method: 'POST', body: JSON.stringify(buildPayload()) }),
    onSuccess: (created) => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); navigate(`/jobs/${created.id}/edit`); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to create job')),
  });
  const updateMutation = useMutation({
    mutationFn: () => apiFetch<JobDetail>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(buildPayload()) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); queryClient.invalidateQueries({ queryKey: ['job', id] }); },
    onError: (err: unknown) => setFormError(getApiErrorMessage(err, 'Failed to save job')),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError('Job title is required');
    if (!categoryId) return setFormError('Category is required');
    if (!employerId) return setFormError('Employer is required');
    if (applicationMethod === 'EXTERNAL_URL' && !externalApplyUrl) return setFormError('External application URL is required');
    if (applicationMethod === 'EMAIL' && !applicationEmail) return setFormError('Application email is required');
    if (isEdit) updateMutation.mutate(); else createMutation.mutate();
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Briefcase size={22} /> {isEdit ? 'Edit Job' : 'New Job'}
        </h1>
        {job && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{job.status}</span>}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Basic Information</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="job-title" className="block text-sm font-medium text-gray-700">Job title</label>
              <input id="job-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="job-summary" className="block text-sm font-medium text-gray-700">Short summary</label>
              <textarea id="job-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="job-employer" className="block text-sm font-medium text-gray-700">Employer</label>
                <select id="job-employer" required value={employerId} onChange={(e) => setEmployerId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select employer</option>
                  {employersResp?.data?.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="job-category" className="block text-sm font-medium text-gray-700">Category</label>
                <select id="job-category" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Job Details</h2>
          <div className="mt-4 space-y-3">
            <div>
              <span className="block text-sm font-medium text-gray-700">Description</span>
              <div className="mt-1">
                <RichTextEditor content={description} onChange={setDescription} placeholder="Describe the role..." />
              </div>
            </div>
            <div>
              <label htmlFor="job-responsibilities" className="block text-sm font-medium text-gray-700">Responsibilities <span className="font-normal text-gray-400">(one per line)</span></label>
              <textarea id="job-responsibilities" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="job-requirements" className="block text-sm font-medium text-gray-700">Requirements <span className="font-normal text-gray-400">(one per line)</span></label>
              <textarea id="job-requirements" value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="job-qualifications" className="block text-sm font-medium text-gray-700">Qualifications <span className="font-normal text-gray-400">(one per line)</span></label>
              <textarea id="job-qualifications" value={qualifications} onChange={(e) => setQualifications(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="job-experience" className="block text-sm font-medium text-gray-700">Experience</label>
                <input id="job-experience" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 2-4 years" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="job-vacancies" className="block text-sm font-medium text-gray-700">Vacancies</label>
                <input id="job-vacancies" type="number" min={1} value={vacancies} onChange={(e) => setVacancies(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="job-employment-type" className="block text-sm font-medium text-gray-700">Employment type</label>
                <select id="job-employment-type" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {EMPLOYMENT_TYPES.map((t) => (<option key={t} value={t}>{t.replace('_', ' ')}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="job-workplace-type" className="block text-sm font-medium text-gray-700">Workplace type</label>
                <select id="job-workplace-type" value={workplaceType} onChange={(e) => setWorkplaceType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {WORKPLACE_TYPES.map((t) => (<option key={t} value={t}>{t.replace('_', ' ')}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="job-salary-min" className="block text-sm font-medium text-gray-700">Salary min (BDT)</label>
                <input id="job-salary-min" type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="job-salary-max" className="block text-sm font-medium text-gray-700">Salary max (BDT)</label>
                <input id="job-salary-max" type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={salaryNegotiable} onChange={(e) => setSalaryNegotiable(e.target.checked)} /> Negotiable
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Location</h2>
          <div className="mt-4">
            <label htmlFor="job-location" className="block text-sm font-medium text-gray-700">Location</label>
            <select id="job-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Unspecified / Remote</option>
              {locations.map((l) => (<option key={l.id} value={l.id}>{l.name} ({l.type})</option>))}
            </select>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Application</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="job-deadline" className="block text-sm font-medium text-gray-700">Application deadline</label>
              <input id="job-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="job-app-method" className="block text-sm font-medium text-gray-700">Application method</label>
              <select id="job-app-method" value={applicationMethod} onChange={(e) => setApplicationMethod(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {APPLICATION_METHODS.map((m) => (<option key={m} value={m}>{m.replace('_', ' ')}</option>))}
              </select>
            </div>
            {applicationMethod === 'EXTERNAL_URL' && (
              <div>
                <label htmlFor="job-external-url" className="block text-sm font-medium text-gray-700">External application URL</label>
                <input id="job-external-url" type="url" required value={externalApplyUrl} onChange={(e) => setExternalApplyUrl(e.target.value)} placeholder="https://employer.example.com/apply" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            )}
            {applicationMethod === 'EMAIL' && (
              <div>
                <label htmlFor="job-app-email" className="block text-sm font-medium text-gray-700">Application email</label>
                <input id="job-app-email" type="email" required value={applicationEmail} onChange={(e) => setApplicationEmail(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            )}
            <div>
              <label htmlFor="job-app-instructions" className="block text-sm font-medium text-gray-700">Application instructions</label>
              <textarea id="job-app-instructions" value={applicationInstructions} onChange={(e) => setApplicationInstructions(e.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {formError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/jobs/all')} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50">
            <Save className="h-4 w-4" /> {isEdit ? 'Save Changes' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  );
}
