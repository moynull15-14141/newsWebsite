import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useDebouncedValue } from '../homepage/useDebouncedValue';
import { isValidHexColor, resolveBackground, reorderByStep, type BackgroundMode, type GradientDirection } from '../lib/breaking-news';
import Dialog from '../components/Dialog';
import {
  Plus, Edit, Trash2, Play, Pause, Radio, Square, ArrowUp, ArrowDown, Link as LinkIcon, X,
} from 'lucide-react';

interface LinkedArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  publishedAt: string | null;
}

interface BreakingNewsItem {
  id: string;
  headline: string;
  articleId: string | null;
  article: LinkedArticle | null;
  isActive: boolean;
  priority: number;
  startAt: string | null;
  endAt: string | null;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientDirection: GradientDirection | null;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  animationSpeedMs: number;
  updatedAt: string;
}

interface ArticleSearchResult {
  id: string;
  title: string;
  slug: string;
  status: string;
}

const GRADIENT_DIRECTIONS: { value: GradientDirection; label: string }[] = [
  { value: 'LEFT_RIGHT', label: 'Left → Right' },
  { value: 'RIGHT_LEFT', label: 'Right → Left' },
  { value: 'TOP_BOTTOM', label: 'Top → Bottom' },
  { value: 'BOTTOM_TOP', label: 'Bottom → Top' },
  { value: 'DIAGONAL', label: 'Diagonal' },
];

interface FormState {
  headline: string;
  articleId: string | null;
  articleLabel: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: GradientDirection;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  animationSpeedSeconds: number;
}

const emptyForm: FormState = {
  headline: '',
  articleId: null,
  articleLabel: '',
  isActive: false,
  startAt: '',
  endAt: '',
  backgroundMode: 'SOLID',
  backgroundColor: '#D32F2F',
  gradientStart: '#D32F2F',
  gradientEnd: '#7A0000',
  gradientDirection: 'LEFT_RIGHT',
  textColor: '#FFFFFF',
  badgeBackgroundColor: '#FFFFFF',
  badgeTextColor: '#D32F2F',
  animationSpeedSeconds: 18,
};

function toFormState(item: BreakingNewsItem): FormState {
  return {
    headline: item.headline,
    articleId: item.articleId,
    articleLabel: item.article ? item.article.title : '',
    isActive: item.isActive,
    startAt: item.startAt ? item.startAt.slice(0, 16) : '',
    endAt: item.endAt ? item.endAt.slice(0, 16) : '',
    backgroundMode: item.backgroundMode,
    backgroundColor: item.backgroundColor,
    gradientStart: item.gradientStart || emptyForm.gradientStart,
    gradientEnd: item.gradientEnd || emptyForm.gradientEnd,
    gradientDirection: item.gradientDirection || 'LEFT_RIGHT',
    textColor: item.textColor,
    badgeBackgroundColor: item.badgeBackgroundColor,
    badgeTextColor: item.badgeTextColor,
    animationSpeedSeconds: Math.round(item.animationSpeedMs / 1000),
  };
}

type TickerStyle = 'CHIPS' | 'MARQUEE' | 'ROTATOR';

interface TickerColors {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientStart: string | null;
  gradientEnd: string | null;
  gradientDirection: GradientDirection | null;
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
}

type TickerDirection = 'LTR' | 'RTL';

/** Marquee-only: which way the headline crawls (see BreakingNewsService's MarqueeSettings comment). */
interface MarqueeSettings extends TickerColors {
  direction: TickerDirection;
  speedMs: number;
}

/** Rotator-only: how long each headline holds before fading to the next — its own setting, independent
 * of any item's animationSpeedMs (see BreakingNewsService's RotatorSettings comment for why). */
interface RotatorSettings extends TickerColors {
  holdMs: number;
}

interface TickerSettings {
  style: TickerStyle;
  marquee: MarqueeSettings;
  rotator: RotatorSettings;
}

const TICKER_STYLE_OPTIONS: { value: TickerStyle; label: string; description: string }[] = [
  { value: 'CHIPS', label: 'Chips', description: 'Each headline is its own colored block (set per item below); all active items scroll together.' },
  { value: 'MARQUEE', label: 'Marquee', description: 'One solid-color bar with a single badge; only the headline text crawls across it. Uses its own colors below, not any item’s.' },
  { value: 'ROTATOR', label: 'Rotator', description: 'No scrolling — one headline shown at a time, fading to the next after a few seconds. Uses its own colors below, not any item’s.' },
];

/** Small static representation of what each style looks like. Chips previews with whichever item is
 * first in the current list (that's what it'll actually use); Marquee/Rotator preview with their own
 * dedicated colors, since that's genuinely what will render regardless of any item's own color. */
function StylePreviewSwatch({ style, sample, colors }: { style: TickerStyle; sample: BreakingNewsItem | undefined; colors: TickerColors }) {
  const background = style === 'CHIPS' ? (sample ? resolveBackground(sample) : '#D32F2F') : resolveBackground(colors);
  const textColor = style === 'CHIPS' ? (sample?.textColor ?? '#FFFFFF') : colors.textColor;
  const badgeBg = style === 'CHIPS' ? (sample?.badgeBackgroundColor ?? '#FFFFFF') : colors.badgeBackgroundColor;
  const badgeText = style === 'CHIPS' ? (sample?.badgeTextColor ?? '#D32F2F') : colors.badgeTextColor;
  const headline = sample?.headline || 'A sample headline appears here';

  if (style === 'ROTATOR') {
    return (
      <div className="flex h-8 items-center justify-center gap-2 overflow-hidden rounded px-2" style={{ background }}>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: badgeBg, color: badgeText }}>News</span>
        <span className="truncate text-xs font-medium" style={{ color: textColor }}>{headline}</span>
      </div>
    );
  }
  if (style === 'MARQUEE') {
    return (
      <div className="flex h-8 items-center gap-2 overflow-hidden rounded px-2" style={{ background }}>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ backgroundColor: badgeBg, color: badgeText }}>News</span>
        <span className="truncate text-xs font-medium" style={{ color: textColor }}>{headline} &nbsp;•&nbsp; {headline}</span>
      </div>
    );
  }
  return (
    <div className="flex h-8 items-center gap-1 overflow-hidden rounded bg-gray-100 px-1">
      {[sample, sample].map((_, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[9px]" style={{ background }}>
          <span className="rounded px-1 py-0.5 font-bold uppercase" style={{ backgroundColor: badgeBg, color: badgeText }}>News</span>
          <span className="max-w-16 truncate font-medium" style={{ color: textColor }}>{headline}</span>
        </span>
      ))}
    </div>
  );
}

/** Inline color editor for a single style's dedicated color set (Marquee or Rotator). Deliberately the
 * same field set/layout as the per-item dialog's color block below, so admins already familiar with that
 * form recognize this one — but this one saves independently (its own Save button), since it isn't part
 * of any single BreakingNews item's form. When `colors` also has `holdMs` (Rotator only — Marquee has
 * nothing to "hold", it scrolls continuously), a duration slider is included and saved along with it. */
function StyleColorEditor<T extends TickerColors>({ colors, onSave, saving }: { colors: T; onSave: (next: T) => void; saving: boolean }) {
  const [draft, setDraft] = useState(colors);
  const holdMs = 'holdMs' in draft ? (draft as unknown as RotatorSettings).holdMs : undefined;
  const setHoldMs = (ms: number) => setDraft({ ...draft, holdMs: ms } as T);
  const direction = 'direction' in draft ? (draft as unknown as MarqueeSettings).direction : undefined;
  const setDirection = (d: TickerDirection) => setDraft({ ...draft, direction: d } as T);
  const speedMs = 'speedMs' in draft ? (draft as unknown as MarqueeSettings).speedMs : undefined;
  const setSpeedMs = (ms: number) => setDraft({ ...draft, speedMs: ms } as T);
  const errors = [
    ['Headline text', draft.textColor],
    ['Badge background', draft.badgeBackgroundColor],
    ['Badge text', draft.badgeTextColor],
    ...(draft.backgroundMode === 'SOLID' ? [['Background color', draft.backgroundColor] as [string, string]] : []),
    ...(draft.backgroundMode === 'GRADIENT' ? [['Gradient start', draft.gradientStart ?? ''] as [string, string], ['Gradient end', draft.gradientEnd ?? ''] as [string, string]] : []),
  ].filter(([, value]) => !isValidHexColor(value)).map(([label]) => `${label} must be a valid hex color.`);

  return (
    <div className="mt-3 space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="radio" checked={draft.backgroundMode === 'SOLID'} onChange={() => setDraft({ ...draft, backgroundMode: 'SOLID' })} /> Solid
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="radio" checked={draft.backgroundMode === 'GRADIENT'} onChange={() => setDraft({ ...draft, backgroundMode: 'GRADIENT' })} /> Gradient
        </label>
      </div>
      {draft.backgroundMode === 'SOLID' ? (
        <ColorField label="Background color" value={draft.backgroundColor} onChange={(v) => setDraft({ ...draft, backgroundColor: v })} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ColorField label="Gradient start" value={draft.gradientStart ?? ''} onChange={(v) => setDraft({ ...draft, gradientStart: v })} />
            <ColorField label="Gradient end" value={draft.gradientEnd ?? ''} onChange={(v) => setDraft({ ...draft, gradientEnd: v })} />
          </div>
          <select
            value={draft.gradientDirection ?? 'LEFT_RIGHT'}
            onChange={(e) => setDraft({ ...draft, gradientDirection: e.target.value as GradientDirection })}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {GRADIENT_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ColorField label="Headline text" value={draft.textColor} onChange={(v) => setDraft({ ...draft, textColor: v })} />
        <ColorField label="Badge background" value={draft.badgeBackgroundColor} onChange={(v) => setDraft({ ...draft, badgeBackgroundColor: v })} />
        <ColorField label="Badge text" value={draft.badgeTextColor} onChange={(v) => setDraft({ ...draft, badgeTextColor: v })} />
      </div>
      {direction !== undefined && (
        <div>
          <span className="block text-sm font-medium text-gray-700">Scroll direction</span>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" name="marquee-direction" checked={direction === 'RTL'} onChange={() => setDirection('RTL')} /> Right → Left (standard)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" name="marquee-direction" checked={direction === 'LTR'} onChange={() => setDirection('LTR')} /> Left → Right
            </label>
          </div>
        </div>
      )}
      {speedMs !== undefined && (
        <div>
          <label htmlFor="marquee-speed" className="block text-sm font-medium text-gray-700">
            Scroll speed: {(speedMs / 1000).toFixed(1)}s per full pass
          </label>
          <input
            id="marquee-speed"
            type="range"
            min={3000}
            max={60000}
            step={1000}
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            className="mt-1 block w-full"
          />
        </div>
      )}
      {holdMs !== undefined && (
        <div>
          <label htmlFor="rotator-hold" className="block text-sm font-medium text-gray-700">
            Headline duration: {(holdMs / 1000).toFixed(1)}s before switching to the next
          </label>
          <input
            id="rotator-hold"
            type="range"
            min={1000}
            max={15000}
            step={500}
            value={holdMs}
            onChange={(e) => setHoldMs(Number(e.target.value))}
            className="mt-1 block w-full"
          />
        </div>
      )}
      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-red-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <button
        type="button"
        onClick={() => errors.length === 0 && onSave(draft)}
        disabled={saving || errors.length > 0}
        className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save colors'}
      </button>
    </div>
  );
}

/** Mutually-exclusive picker for the whole banner's presentation — selecting one turns the others off,
 * since the public site can only render one style at a time. Chips keeps each item's own colors; Marquee
 * and Rotator each get their own dedicated color set, expandable per card, since there's no single
 * item's color to fall back to once several differently-colored items share one bar. Reads/writes via
 * the breaking-news module's own `/breaking-news/settings` (gated by breaking_news.manage, same as
 * everything else on this page — not the site-wide settings.manage permission, which this role doesn't
 * necessarily hold). */
function TickerStylePicker({ sample }: { sample: BreakingNewsItem | undefined }) {
  const queryClient = useQueryClient();
  const [editingStyle, setEditingStyle] = useState<'marquee' | 'rotator' | null>(null);
  const { data } = useQuery<TickerSettings>({
    queryKey: ['breaking-news-ticker-settings-admin'],
    queryFn: () => apiFetch('/breaking-news/settings'),
  });
  const mutation = useMutation({
    mutationFn: (patch: Partial<TickerSettings>) => apiFetch('/breaking-news/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['breaking-news-ticker-settings-admin'] }),
  });

  if (!data) return null;
  const active = data.style;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Ticker style</h2>
      <p className="mt-0.5 text-xs text-gray-500">Choose how the live banner presents itself on the public site. Only one style is shown at a time.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TICKER_STYLE_OPTIONS.map((option) => {
          const isActive = option.value === active;
          const colorsKey = option.value === 'MARQUEE' ? 'marquee' : option.value === 'ROTATOR' ? 'rotator' : null;
          const isEditingThis = colorsKey === editingStyle;
          return (
            <div
              key={option.value}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isActive ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <button type="button" onClick={() => mutation.mutate({ style: option.value })} disabled={mutation.isPending} aria-pressed={isActive} className="w-full text-left disabled:opacity-60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {isActive ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="mt-2"><StylePreviewSwatch style={option.value} sample={sample} colors={option.value === 'ROTATOR' ? data.rotator : data.marquee} /></div>
                <p className="mt-2 text-xs text-gray-500">{option.description}</p>
              </button>
              {colorsKey && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingStyle(isEditingThis ? null : colorsKey)}
                    className="mt-2 text-xs font-semibold text-primary-600 hover:underline"
                  >
                    {isEditingThis ? 'Hide colors' : 'Customize colors'}
                  </button>
                  {isEditingThis && (
                    <StyleColorEditor
                      colors={data[colorsKey]}
                      saving={mutation.isPending}
                      onSave={(next) => mutation.mutate({ [colorsKey]: next })}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mirrors the public ticker's own single-item look (see apps/web BreakingNewsTicker) so what the admin
 * sees here is what readers will actually see — same background/gradient resolution, same badge. */
function TickerPreview({ form }: { form: FormState }) {
  const background = resolveBackground(form);
  return (
    <div
      className="overflow-hidden rounded-md border border-gray-200 py-2.5"
      style={{ background }}
      aria-label="Live preview of the breaking news ticker"
    >
      <div className="flex items-center gap-3 px-4">
        <span
          className="shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
          style={{ backgroundColor: form.badgeBackgroundColor, color: form.badgeTextColor }}
        >
          Breaking News
        </span>
        <span className="truncate text-sm font-medium" style={{ color: form.textColor }}>
          {form.headline || 'Your headline will appear here'}
        </span>
      </div>
    </div>
  );
}

export default function BreakingNewsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [articleSearch, setArticleSearch] = useState('');
  const debouncedArticleSearch = useDebouncedValue(articleSearch, 300);
  const [colorErrors, setColorErrors] = useState<string[]>([]);

  const { data: items, isLoading, isError, error } = useQuery<BreakingNewsItem[]>({
    queryKey: ['breaking-news-admin'],
    queryFn: () => apiFetch('/breaking-news'),
  });

  const articleResults = useQuery<{ data: ArticleSearchResult[] }>({
    queryKey: ['breaking-news-article-search', debouncedArticleSearch],
    queryFn: () => apiFetch(`/articles?search=${encodeURIComponent(debouncedArticleSearch)}&limit=8`),
    enabled: debouncedArticleSearch.trim().length > 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['breaking-news-admin'] });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch('/breaking-news', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setDialogOpen(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => apiFetch(`/breaking-news/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { invalidate(); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/breaking-news/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  const activateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/breaking-news/${id}/activate`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/breaking-news/${id}/deactivate`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const publishNowMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/breaking-news/${id}/publish-now`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const stopMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/breaking-news/${id}/stop`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => apiFetch('/breaking-news/reorder', { method: 'PATCH', body: JSON.stringify({ orderedIds }) }),
    onSuccess: invalidate,
  });

  const anyError = createMutation.error ?? updateMutation.error ?? deleteMutation.error ?? activateMutation.error
    ?? deactivateMutation.error ?? publishNowMutation.error ?? stopMutation.error ?? reorderMutation.error;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setArticleSearch('');
    setColorErrors([]);
    setDialogOpen(true);
  };

  const openEdit = (item: BreakingNewsItem) => {
    setEditingId(item.id);
    setForm(toFormState(item));
    setArticleSearch('');
    setColorErrors([]);
    setDialogOpen(true);
  };

  const validateColors = (): string[] => {
    const checks: [string, string][] = [
      ['Headline text color', form.textColor],
      ['Badge background', form.badgeBackgroundColor],
      ['Badge text color', form.badgeTextColor],
      ...(form.backgroundMode === 'SOLID' ? [['Background color', form.backgroundColor] as [string, string]] : []),
      ...(form.backgroundMode === 'GRADIENT' ? [['Gradient start', form.gradientStart] as [string, string], ['Gradient end', form.gradientEnd] as [string, string]] : []),
    ];
    return checks.filter(([, value]) => !isValidHexColor(value)).map(([label]) => `${label} must be a valid hex color.`);
  };

  const handleSubmit = () => {
    const errors = validateColors();
    setColorErrors(errors);
    if (errors.length > 0 || !form.headline.trim()) return;

    const data: Record<string, unknown> = {
      headline: form.headline.trim(),
      articleId: form.articleId,
      isActive: form.isActive,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
      backgroundMode: form.backgroundMode,
      backgroundColor: form.backgroundColor,
      gradientStart: form.backgroundMode === 'GRADIENT' ? form.gradientStart : null,
      gradientEnd: form.backgroundMode === 'GRADIENT' ? form.gradientEnd : null,
      gradientDirection: form.backgroundMode === 'GRADIENT' ? form.gradientDirection : null,
      textColor: form.textColor,
      badgeBackgroundColor: form.badgeBackgroundColor,
      badgeTextColor: form.badgeTextColor,
      animationSpeedMs: Math.max(2000, form.animationSpeedSeconds * 1000),
    };

    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const move = (index: number, direction: 'up' | 'down') => {
    if (!items) return;
    reorderMutation.mutate(reorderByStep(items, index, direction));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Breaking News</h1>
          <p className="mt-1 text-sm text-gray-500">Manage the live ticker shown at the top of the public site.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" /> New Breaking News
        </button>
      </div>

      <TickerStylePicker sample={items?.[0]} />

      {anyError && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getApiErrorMessage(anyError, 'Action failed. Please try again.')}
        </p>
      )}

      {isLoading ? (
        <div className="mt-8 text-center text-gray-500">Loading...</div>
      ) : isError ? (
        <p role="alert" className="mt-8 text-center text-sm text-red-700">{getApiErrorMessage(error, 'Could not load breaking news.')}</p>
      ) : !items?.length ? (
        <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
          No breaking news items yet. Create one to start the ticker.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Headline</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Article</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">End</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Appearance</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm font-medium text-gray-900">
                    <span className="line-clamp-2">{item.headline}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.article ? (
                      <span className="inline-flex items-center gap-1"><LinkIcon className="h-3 w-3" /> {item.article.title}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      {item.priority}
                      <button onClick={() => move(index, 'up')} disabled={index === 0} title="Move up" className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button onClick={() => move(index, 'down')} disabled={index === items.length - 1} title="Move down" className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.startAt ? new Date(item.startAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.endAt ? new Date(item.endAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block h-5 w-10 rounded border border-gray-300"
                      style={{ background: resolveBackground(item) }}
                      title={item.backgroundMode === 'GRADIENT' ? `Gradient ${item.gradientStart} → ${item.gradientEnd}` : item.backgroundColor}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(item)} title="Edit" aria-label={`Edit: ${item.headline}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Edit className="h-4 w-4" /></button>
                      {item.isActive ? (
                        <button onClick={() => deactivateMutation.mutate(item.id)} title="Deactivate" aria-label={`Deactivate: ${item.headline}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Pause className="h-4 w-4" /></button>
                      ) : (
                        <button onClick={() => activateMutation.mutate(item.id)} title="Activate" aria-label={`Activate: ${item.headline}`} className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><Play className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => publishNowMutation.mutate(item.id)} title="Publish now" aria-label={`Publish now: ${item.headline}`} className="rounded p-1.5 text-green-600 hover:bg-gray-100"><Radio className="h-4 w-4" /></button>
                      <button onClick={() => stopMutation.mutate(item.id)} title="Stop immediately" aria-label={`Stop: ${item.headline}`} className="rounded p-1.5 text-amber-600 hover:bg-gray-100"><Square className="h-4 w-4" /></button>
                      <button
                        onClick={() => { if (confirm(`Archive "${item.headline}"?`)) deleteMutation.mutate(item.id); }}
                        title="Archive"
                        aria-label={`Archive: ${item.headline}`}
                        className="rounded p-1.5 text-red-600 hover:bg-gray-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <Dialog
          title={editingId ? 'Edit Breaking News' : 'New Breaking News'}
          size="lg"
          onClose={() => setDialogOpen(false)}
          footer={
            <>
              <button onClick={() => setDialogOpen(false)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Live preview</span>
              <TickerPreview form={form} />
            </div>

            <div>
              <label htmlFor="bn-headline" className="block text-sm font-medium text-gray-700">Headline</label>
              <input
                id="bn-headline"
                data-autofocus
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                maxLength={300}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="e.g. Dhaka Metro announces new schedule"
              />
            </div>

            <div>
              <label htmlFor="bn-active" className="flex items-center gap-2 text-sm text-gray-700">
                <input id="bn-active" type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active (shows on the public ticker when its schedule window allows)
              </label>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700">Link to an article (optional)</span>
              {form.articleId ? (
                <div className="mt-1 flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <span className="truncate">{form.articleLabel}</span>
                  <button onClick={() => setForm({ ...form, articleId: null, articleLabel: '' })} aria-label="Remove article link" className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <input
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Search articles by title…"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {debouncedArticleSearch.trim().length > 1 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                      {articleResults.isLoading ? (
                        <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
                      ) : !articleResults.data?.data?.length ? (
                        <li className="px-3 py-2 text-sm text-gray-500">No matching articles.</li>
                      ) : (
                        articleResults.data.data.map((a) => (
                          <li key={a.id}>
                            <button
                              onClick={() => { setForm({ ...form, articleId: a.id, articleLabel: a.title }); setArticleSearch(''); }}
                              className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              {a.title} <span className="text-xs text-gray-400">({a.status})</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">The headline links to the article only while it is publicly published — an unpublished/archived link is hidden automatically, not exposed.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bn-start" className="block text-sm font-medium text-gray-700">Start (optional)</label>
                <input id="bn-start" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="bn-end" className="block text-sm font-medium text-gray-700">End (optional)</label>
                <input id="bn-end" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700">Background</span>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name="bn-bg-mode" checked={form.backgroundMode === 'SOLID'} onChange={() => setForm({ ...form, backgroundMode: 'SOLID' })} /> Solid
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="radio" name="bn-bg-mode" checked={form.backgroundMode === 'GRADIENT'} onChange={() => setForm({ ...form, backgroundMode: 'GRADIENT' })} /> Gradient
                </label>
              </div>
            </div>

            {form.backgroundMode === 'SOLID' ? (
              <ColorField label="Background color" value={form.backgroundColor} onChange={(v) => setForm({ ...form, backgroundColor: v })} />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ColorField label="Gradient start" value={form.gradientStart} onChange={(v) => setForm({ ...form, gradientStart: v })} />
                  <ColorField label="Gradient end" value={form.gradientEnd} onChange={(v) => setForm({ ...form, gradientEnd: v })} />
                </div>
                <div>
                  <label htmlFor="bn-gradient-dir" className="block text-sm font-medium text-gray-700">Gradient direction</label>
                  <select
                    id="bn-gradient-dir"
                    value={form.gradientDirection}
                    onChange={(e) => setForm({ ...form, gradientDirection: e.target.value as GradientDirection })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {GRADIENT_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ColorField label="Headline text" value={form.textColor} onChange={(v) => setForm({ ...form, textColor: v })} />
              <ColorField label="Badge background" value={form.badgeBackgroundColor} onChange={(v) => setForm({ ...form, badgeBackgroundColor: v })} />
              <ColorField label="Badge text" value={form.badgeTextColor} onChange={(v) => setForm({ ...form, badgeTextColor: v })} />
            </div>

            <div>
              <label htmlFor="bn-speed" className="block text-sm font-medium text-gray-700">Animation speed: {form.animationSpeedSeconds}s per full cycle</label>
              <input
                id="bn-speed"
                type="range"
                min={5}
                max={60}
                value={form.animationSpeedSeconds}
                onChange={(e) => setForm({ ...form, animationSpeedSeconds: Number(e.target.value) })}
                className="mt-1 block w-full"
              />
            </div>

            {colorErrors.length > 0 && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <ul className="list-disc space-y-0.5 pl-4">{colorErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            {!form.headline.trim() && (
              <p className="text-xs text-gray-400">A headline is required before this can be saved.</p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [id] = useState(() => `color-${Math.random().toString(36).slice(2)}`);
  const valid = isValidHexColor(value);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-gray-300 p-0.5"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className={`block w-full rounded-md border px-3 py-2 text-sm ${valid ? 'border-gray-300' : 'border-red-400'}`}
          placeholder="#D32F2F"
        />
      </div>
    </div>
  );
}
