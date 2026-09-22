import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FolderTree,
  List,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

/** Every administrative level the platform can represent (mirrors LOCATION_TYPES in the API). */
const ALL_LOCATION_TYPES = ['CONTINENT', 'COUNTRY', 'STATE', 'PROVINCE', 'REGION', 'DIVISION', 'DISTRICT', 'COUNTY', 'CITY', 'MUNICIPALITY', 'UPAZILA', 'SUBDISTRICT', 'OTHER'] as const;
type LocationTypeValue = (typeof ALL_LOCATION_TYPES)[number];

/**
 * Which parent types are acceptable for each type, and whether a parent is required at all — mirrors
 * PARENT_TYPE_RULES in apps/api/src/modules/locations/location-types.ts. Bangladesh's own rule
 * (DIVISION/DISTRICT/UPAZILA) is unchanged from before global location support existed; the rest are
 * intentionally permissive because real-world hierarchies vary by country.
 */
const PARENT_TYPE_RULES: Record<LocationTypeValue, { allowed: LocationTypeValue[]; required: boolean }> = {
  CONTINENT: { allowed: [], required: false },
  COUNTRY: { allowed: ['CONTINENT'], required: false },
  STATE: { allowed: ['COUNTRY'], required: false },
  PROVINCE: { allowed: ['COUNTRY'], required: false },
  REGION: { allowed: ['COUNTRY', 'CONTINENT'], required: false },
  DIVISION: { allowed: ['COUNTRY'], required: true },
  DISTRICT: { allowed: ['DIVISION', 'STATE', 'PROVINCE', 'REGION', 'COUNTY'], required: true },
  COUNTY: { allowed: ['STATE', 'PROVINCE', 'COUNTRY'], required: false },
  CITY: { allowed: ['COUNTRY', 'STATE', 'PROVINCE', 'REGION', 'COUNTY', 'DIVISION', 'DISTRICT'], required: false },
  MUNICIPALITY: { allowed: ['DISTRICT', 'COUNTY', 'STATE', 'PROVINCE', 'CITY'], required: false },
  UPAZILA: { allowed: ['DISTRICT'], required: true },
  SUBDISTRICT: { allowed: ['DISTRICT', 'COUNTY', 'CITY'], required: false },
  OTHER: { allowed: [...ALL_LOCATION_TYPES.filter((t) => t !== 'OTHER')], required: false },
};

interface LocationTranslation {
  languageId: string;
  name: string;
}

interface LanguageOption {
  id: string;
  code: string;
  name: string;
  nativeName: string;
}

interface LocationItem {
  id: string;
  name: string;
  slug: string;
  type: LocationTypeValue;
  parentId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  countryCode?: string | null;
  createdAt: string;
  parent?: { id: string; name: string; type: string; slug: string } | null;
  _count?: { articles: number; children: number };
  translations?: LocationTranslation[];
}

interface LocationTreeResponse {
  country: LocationItem | null;
  divisions: (LocationItem & {
    districts: (LocationItem & {
      upazilas?: LocationItem[];
    })[];
  })[];
  totalCount: number;
}

function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const TYPE_BADGE_COLORS: Partial<Record<LocationTypeValue, string>> = {
  CONTINENT: 'bg-indigo-100 text-indigo-700',
  COUNTRY: 'bg-purple-100 text-purple-700',
  STATE: 'bg-sky-100 text-sky-700',
  PROVINCE: 'bg-sky-100 text-sky-700',
  REGION: 'bg-sky-100 text-sky-700',
  DIVISION: 'bg-blue-100 text-blue-700',
  DISTRICT: 'bg-teal-100 text-teal-700',
  COUNTY: 'bg-cyan-100 text-cyan-700',
  CITY: 'bg-amber-100 text-amber-700',
  MUNICIPALITY: 'bg-amber-100 text-amber-700',
  UPAZILA: 'bg-emerald-100 text-emerald-700',
  SUBDISTRICT: 'bg-emerald-100 text-emerald-700',
};
const locationTypeBadge = (type: LocationTypeValue) => TYPE_BADGE_COLORS[type] ?? 'bg-gray-100 text-gray-700';

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('settings.manage');

  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LocationTypeValue>('ALL');
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [type, setType] = useState<LocationTypeValue>('DISTRICT');
  const [parentId, setParentId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [countryCode, setCountryCode] = useState('');
  const [translationNames, setTranslationNames] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: treeData, isLoading: treeLoading, refetch: refetchTree } = useQuery<LocationTreeResponse>({
    queryKey: ['locations-tree'],
    queryFn: () => apiFetch('/locations/tree'),
  });

  const { data: allLocations = [], isLoading: listLoading, refetch: refetchAll } = useQuery<LocationItem[]>({
    queryKey: ['locations-all'],
    queryFn: () => apiFetch('/locations?all=true'),
  });

  const { data: languages = [] } = useQuery<LanguageOption[]>({ queryKey: ['languages'], queryFn: () => apiFetch('/languages') });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      slug: string;
      type: string;
      parentId?: string | null;
      status?: string;
      countryCode?: string;
      translations?: LocationTranslation[];
    }) => apiFetch('/locations', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to create location'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      slug?: string;
      parentId?: string | null;
      status?: string;
      countryCode?: string | null;
      translations?: LocationTranslation[];
    }) => apiFetch(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to update location'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, 'Failed to delete location'));
    },
  });

  const toggleDivision = (divId: string) => {
    setExpandedDivisions((prev) => ({ ...prev, [divId]: !prev[divId] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    treeData?.divisions.forEach((d) => {
      next[d.id] = true;
    });
    setExpandedDivisions(next);
  };

  const collapseAll = () => {
    setExpandedDivisions({});
  };

  const openCreateModal = (defaultType?: LocationTypeValue, defaultParentId?: string) => {
    setEditingLoc(null);
    setName('');
    setSlug('');
    setSlugManuallyEdited(false);
    setType(defaultType || 'DISTRICT');
    setParentId(defaultParentId || '');
    setStatus('ACTIVE');
    setCountryCode('');
    setTranslationNames({});
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (loc: LocationItem) => {
    setEditingLoc(loc);
    setName(loc.name);
    setSlug(loc.slug);
    setSlugManuallyEdited(true);
    setType(loc.type);
    setParentId(loc.parentId || '');
    setStatus(loc.status);
    setCountryCode(loc.countryCode || '');
    setTranslationNames(Object.fromEntries((loc.translations ?? []).map((t) => [t.languageId, t.name])));
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingLoc(null);
    setFormError(null);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Location name is required');
      return;
    }
    if (!slug.trim()) {
      setFormError('Slug is required');
      return;
    }

    if (PARENT_TYPE_RULES[type].required && !parentId) {
      setFormError(`A ${type.toLowerCase()} must have a parent location.`);
      return;
    }

    const translations = languages
      .map((lang) => ({ languageId: lang.id, name: (translationNames[lang.id] || '').trim() }))
      .filter((t) => t.name);

    if (editingLoc) {
      updateMutation.mutate({
        id: editingLoc.id,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        parentId: parentId || null,
        status,
        countryCode: countryCode.trim() || null,
        translations,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        type,
        parentId: parentId || null,
        status,
        countryCode: countryCode.trim() || undefined,
        translations,
      });
    }
  };

  const handleDelete = (loc: LocationItem) => {
    const articles = loc._count?.articles || 0;
    const children = loc._count?.children || 0;
    if (articles > 0) {
      alert(`Cannot delete "${loc.name}" because it has ${articles} associated article(s).`);
      return;
    }
    if (children > 0) {
      alert(`Cannot delete "${loc.name}" because it contains ${children} sub-location(s).`);
      return;
    }
    if (confirm(`Are you sure you want to delete ${loc.type.toLowerCase()} "${loc.name}"?`)) {
      deleteMutation.mutate(loc.id);
    }
  };

  const filteredLocations = allLocations.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.slug.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || l.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const parentRule = PARENT_TYPE_RULES[type];
  const availableParents = parentRule.allowed.length
    ? allLocations.filter((l) => parentRule.allowed.includes(l.type))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MapPin className="h-6 w-6 text-primary-500" />
            Locations & Geography
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage Bangladesh divisions, 64 districts, and local regional coverage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-gray-300 bg-white p-0.5">
            <button
              onClick={() => setViewMode('tree')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'tree'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderTree className="h-4 w-4" />
              Tree View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'table'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              Table View
            </button>
          </div>

          {canManage && (
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
            >
              <Plus className="h-4 w-4" />
              Add Location
            </button>
          )}
        </div>
      </div>

      {/* Country Summary Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary-600 p-2 text-white">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">
              {treeData?.country?.name || 'Bangladesh'}
            </h2>
            <p className="text-xs text-gray-600">
              8 Divisions · 64 Districts · Total {treeData?.totalCount || allLocations.length} locations configured
            </p>
          </div>
        </div>

        {viewMode === 'tree' && (
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Collapse All
            </button>
            <button
              onClick={() => {
                refetchTree();
                refetchAll();
              }}
              title="Refresh"
              className="rounded border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Search Bar for Table View */}
      {viewMode === 'table' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by location name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | LocationTypeValue)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">All Types</option>
            {ALL_LOCATION_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      )}

      {/* CONTENT: Tree View */}
      {viewMode === 'tree' ? (
        treeLoading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading Bangladesh hierarchy tree...
          </div>
        ) : (
          <div className="space-y-4">
            {treeData?.divisions.map((div) => {
              const isExpanded = expandedDivisions[div.id] ?? false;
              const districtCount = div.districts.length;
              const totalArticles =
                (div._count?.articles || 0) +
                div.districts.reduce((acc, d) => acc + (d._count?.articles || 0), 0);

              return (
                <div
                  key={div.id}
                  className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:border-gray-300"
                >
                  {/* Division Header */}
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 px-4 py-3 cursor-pointer select-none"
                    onClick={() => toggleDivision(div.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                      </span>
                      <span className="font-bold text-gray-900">{div.name} Division</span>
                      <span className="text-xs font-mono text-gray-400">/{div.slug}</span>
                      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                        {districtCount} Districts
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {totalArticles} articles in division
                      </span>

                      {canManage && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openCreateModal('DISTRICT', div.id)}
                            title="Add District to this Division"
                            className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add District
                          </button>
                          <button
                            onClick={() => openEditModal(div)}
                            title="Edit Division"
                            className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-primary-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Districts List when expanded */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 border-t border-gray-200 p-4">
                      {div.districts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No districts configured yet.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {div.districts.map((dist) => (
                            <div
                              key={dist.id}
                              className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50/50 px-3 py-2 hover:bg-white hover:border-primary-200 transition"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="truncate text-sm font-medium text-gray-800">{dist.name}</p>
                                <p className="text-[11px] text-gray-400 font-mono">/{dist.slug}</p>
                              </div>

                              <div className="flex items-center gap-1">
                                {dist._count?.articles ? (
                                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                                    {dist._count.articles}
                                  </span>
                                ) : null}

                                {canManage && (
                                  <button
                                    onClick={() => openEditModal(dist)}
                                    title="Edit District"
                                    className="rounded p-1 text-gray-400 hover:text-primary-600"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* CONTENT: Flat Table View */
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {listLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading locations...</div>
          ) : filteredLocations.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No locations match your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Location</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Parent</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Articles</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLocations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{loc.name}</div>
                        <div className="text-xs text-gray-400 font-mono">/{loc.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${locationTypeBadge(loc.type)}`}>
                          {loc.type}
                        </span>
                        {loc.countryCode && <span className="ml-1.5 font-mono text-[10px] text-gray-400">{loc.countryCode}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {loc.parent ? loc.parent.name : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {loc._count?.articles || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            loc.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {loc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(loc)}
                              title="Edit Location"
                              className="rounded p-1 text-gray-500 hover:text-primary-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(loc)}
                              title="Delete Location"
                              className="rounded p-1 text-gray-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Location Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingLoc ? `Edit ${editingLoc.type}` : 'Add Location'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Location Type</label>
                <select
                  value={type}
                  disabled={!!editingLoc}
                  onChange={(e) => {
                    setType(e.target.value as LocationTypeValue);
                    setParentId('');
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                >
                  {ALL_LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Bangladesh uses DIVISION/DISTRICT/UPAZILA. Other types (CONTINENT, COUNTRY, STATE, CITY, …) cover the rest of the world.</p>
              </div>

              {availableParents.length > 0 || parentRule.required ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Parent location {parentRule.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      required={parentRule.required}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">{parentRule.required ? 'Select parent…' : 'None (top level)'}</option>
                      {availableParents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>
              ) : (
                <p className="text-xs text-gray-500">A {type.toLowerCase()} is always top-level (no parent).</p>
              )}

              {(type === 'COUNTRY' || type === 'CONTINENT') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Country code (optional)</label>
                  <input
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="e.g. IN, US, GB"
                    className="mt-1 block w-full max-w-[8rem] rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">ISO 3166-1 alpha-2. Children inherit this automatically if left blank.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Gazipur, Sylhet"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                  }}
                  placeholder="e.g. gazipur"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {languages.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-700">Localized names</p>
                  <p className="mt-0.5 text-xs text-gray-500">Optional — the same place, shown in each language (e.g. Dhaka / ঢাকা).</p>
                  <div className="mt-2 space-y-2">
                    {languages.map((lang) => (
                      <label key={lang.id} className="flex items-center gap-2 text-sm">
                        <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">{lang.nativeName}</span>
                        <input
                          value={translationNames[lang.id] || ''}
                          onChange={(e) => setTranslationNames({ ...translationNames, [lang.id]: e.target.value })}
                          placeholder={lang.code === 'bn' ? 'যেমন ঢাকা' : name || lang.name}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {editingLoc ? 'Save Changes' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
