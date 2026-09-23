import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { applyTheme, getThemePreference, type ThemePreference } from '../lib/theme';

export default function SettingsPage() { const { data } = useQuery<Record<string, string>>({ queryKey: ['platform-settings'], queryFn: () => apiFetch('/editorial/settings') }); const [values, setValues] = useState<Record<string, string>>({}); const save = useMutation({ mutationFn: () => apiFetch('/editorial/settings', { method: 'PATCH', body: JSON.stringify(values) }) }); const get = (key: string) => values[key] ?? data?.[key] ?? ''; const field = (key: string, label: string) => <label className="block text-sm font-medium text-gray-700">{label}<input value={get(key)} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label>;
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());
  return <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Settings size={22} /> Platform settings</h1>
    <div className="mt-6 max-w-2xl space-y-4 rounded border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Appearance</h2>
      <p className="text-sm text-gray-500">Applies to this browser only, for your own admin session.</p>
      <div className="flex flex-wrap gap-4">
        {(['LIGHT', 'DARK', 'SYSTEM'] as ThemePreference[]).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="admin-theme"
              checked={theme === value}
              onChange={() => { setTheme(value); applyTheme(value); }}
            />
            {value[0] + value.slice(1).toLowerCase()}
          </label>
        ))}
      </div>
    </div>
    <div className="mt-6 max-w-2xl space-y-4 rounded border border-gray-200 bg-white p-5">{field('siteName', 'Site name')}{field('siteDescription', 'Site description')}{field('defaultSeoTitle', 'Default SEO title')}{field('defaultSeoDescription', 'Default SEO description')}{field('contactEmail', 'Contact email')}<button onClick={() => save.mutate()} className="inline-flex items-center gap-2 rounded bg-primary-500 px-4 py-2 text-sm font-semibold text-white"><Save size={16} /> Save settings</button></div>
  </div>; }
