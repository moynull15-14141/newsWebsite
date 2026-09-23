import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_BASE, ApiError } from '@/lib/api';
import { applyTheme, getThemePreference, type ThemePreference } from '@/lib/theme';
import { useReaderAuthStore } from '@/stores/reader-auth-store';
import SeoHead from '@/components/SeoHead';

interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  readerProfile?: {
    displayName: string;
    phone?: string | null;
    bio?: string | null;
    location?: string | null;
    theme: ThemePreference;
    profilePublic: boolean;
    avatar?: { publicUrl: string } | null;
  } | null;
  notificationPreference?: {
    breakingNews: boolean;
    categoryNews: boolean;
    locationNews: boolean;
    jobAlerts: boolean;
    accountSecurity: boolean;
  } | null;
}

function Guard({ children }: { children: React.ReactNode }) {
  return useReaderAuthStore((state) => state.user) ? children : <Navigate to="/login" replace />;
}

export function ReaderProfilePage() {
  const queryClient = useQueryClient();
  const token = useReaderAuthStore((state) => state.accessToken);
  const { data } = useQuery<ProfileResponse>({
    queryKey: ['reader-profile'],
    queryFn: () => apiFetch('/reader/me'),
  });
  const [form, setForm] = useState({
    displayName: '',
    phone: '',
    bio: '',
    location: '',
    profilePublic: false,
  });
  useEffect(() => {
    if (data)
      setForm({
        displayName: data.readerProfile?.displayName || data.name,
        phone: data.readerProfile?.phone || '',
        bio: data.readerProfile?.bio || '',
        location: data.readerProfile?.location || '',
        profilePublic: data.readerProfile?.profilePublic ?? false,
      });
  }, [data]);
  const save = useMutation({
    mutationFn: () => apiFetch('/reader/me', { method: 'PATCH', body: JSON.stringify(form) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reader-profile'] }),
  });
  const [avatarError, setAvatarError] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    setAvatarError('');
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await fetch(`${API_BASE}/reader/me/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!response.ok) {
        setAvatarError(
          response.status === 413 || response.status === 400
            ? 'That image could not be used. Please upload a JPEG, PNG or WebP under 2MB.'
            : 'Avatar upload failed. Please try again.',
        );
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['reader-profile'] });
    } catch {
      setAvatarError('Avatar upload failed. Please check your connection and try again.');
    }
  };
  return (
    <Guard>
      <SeoHead title="Profile" noIndex />
      <main className="container-narrow py-10">
        <h1 className="text-3xl font-serif font-bold">Your profile</h1>
        <p className="mt-2 text-sm text-gray-500">
          Member since {data?.createdAt ? new Date(data.createdAt).toLocaleDateString() : '—'}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="mt-8 space-y-5"
        >
          <div className="flex items-center gap-4">
            {data?.readerProfile?.avatar?.publicUrl ? (
              <img
                src={data.readerProfile.avatar.publicUrl}
                alt="Profile avatar"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="h-20 w-20 rounded-full bg-neutral-200"
                aria-label="No profile avatar"
              />
            )}
            <label className="text-sm font-medium">
              Profile photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  upload(event.target.files?.[0]);
                  event.target.value = '';
                }}
                className="mt-2 block max-w-full text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">JPEG, PNG or WebP, up to 2MB.</span>
              {avatarError && (
                <span role="alert" className="mt-1 block text-xs text-red-600">
                  {avatarError}
                </span>
              )}
            </label>
          </div>
          <Field
            label="Name"
            value={form.displayName}
            onChange={(displayName) => setForm({ ...form, displayName })}
          />
          <label className="block text-sm font-medium">
            Email
            <input
              disabled
              value={data?.email || ''}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-70"
            />
          </label>
          <Field
            label="Phone"
            value={form.phone}
            onChange={(phone) => setForm({ ...form, phone })}
          />
          <Field
            label="Location"
            value={form.location}
            onChange={(location) => setForm({ ...form, location })}
          />
          <label className="block text-sm font-medium">
            Short bio
            <textarea
              maxLength={500}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
              className="mt-1 min-h-28 w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.profilePublic}
              onChange={(event) => setForm({ ...form, profilePublic: event.target.checked })}
            />{' '}
            Allow a basic public profile
          </label>
          <button
            disabled={save.isPending}
            className="rounded bg-primary-500 px-5 py-2 font-semibold text-white"
          >
            Save profile
          </button>
          {save.isSuccess && (
            <p role="status" className="text-sm text-green-700">
              Profile updated.
            </p>
          )}
          {save.isError && (
            <p role="alert" className="text-sm text-red-600">
              {save.error instanceof ApiError && save.error.status === 400
                ? 'Please check your details and try again.'
                : 'Could not save your profile. Please try again.'}
            </p>
          )}
        </form>
      </main>
    </Guard>
  );
}

export function ReaderSettingsPage() {
  const clearAuth = useReaderAuthStore((state) => state.clearAuth);
  const { data } = useQuery<ProfileResponse>({
    queryKey: ['reader-profile'],
    queryFn: () => apiFetch('/reader/me'),
  });
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference());
  const [prefs, setPrefs] = useState({
    breakingNews: true,
    categoryNews: true,
    locationNews: true,
    jobAlerts: false,
    accountSecurity: true,
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  useEffect(() => {
    // Pick only the known preference fields — the API response also carries id/userId/createdAt/
    // updatedAt on this row, and spreading it wholesale rendered those as bogus always-checked
    // checkboxes ("id", "created At", ...) in the notifications list below.
    const preference = data?.notificationPreference;
    if (preference)
      setPrefs({
        breakingNews: preference.breakingNews,
        categoryNews: preference.categoryNews,
        locationNews: preference.locationNews,
        jobAlerts: preference.jobAlerts,
        accountSecurity: preference.accountSecurity,
      });
    if (data?.readerProfile?.theme) {
      setTheme(data.readerProfile.theme);
      applyTheme(data.readerProfile.theme);
    }
  }, [data]);
  const saveSettings = async () => {
    applyTheme(theme);
    try {
      await Promise.all([
        apiFetch('/reader/me', { method: 'PATCH', body: JSON.stringify({ theme }) }),
        apiFetch('/reader/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
      ]);
      setMessageType('success');
      setMessage('Settings saved.');
    } catch {
      setMessageType('error');
      setMessage('Could not save your settings. Please try again.');
    }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.newPassword.length < 8) {
      setMessageType('error');
      return setMessage('New password must be at least 8 characters.');
    }
    if (passwords.newPassword !== passwords.confirm) {
      setMessageType('error');
      return setMessage('Passwords do not match.');
    }
    try {
      await apiFetch('/reader/me/password', { method: 'PATCH', body: JSON.stringify(passwords) });
      clearAuth();
      location.assign('/login');
    } catch (error) {
      setMessageType('error');
      setMessage(
        error instanceof ApiError && error.status === 403
          ? 'Current password is incorrect.'
          : error instanceof ApiError && error.status === 400
            ? 'New password must be different from your current password.'
            : 'Could not change your password. Please try again.',
      );
    }
  };
  return (
    <Guard>
      <SeoHead title="Account settings" noIndex />
      <main className="container-narrow py-10">
        <h1 className="text-3xl font-serif font-bold">Account settings</h1>
        <section className="mt-8 border-t py-6">
          <h2 className="text-xl font-semibold">Appearance</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {(['LIGHT', 'DARK', 'SYSTEM'] as ThemePreference[]).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={theme === value}
                  onChange={() => {
                    setTheme(value);
                    applyTheme(value);
                  }}
                />
                {value[0] + value.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </section>
        <section className="border-t py-6">
          <h2 className="text-xl font-semibold">Notifications</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(prefs).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => setPrefs({ ...prefs, [key]: event.target.checked })}
                />
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>
          <button
            onClick={saveSettings}
            className="mt-5 rounded bg-primary-500 px-5 py-2 font-semibold text-white"
          >
            Save settings
          </button>
        </section>
        <form onSubmit={changePassword} className="border-t py-6">
          <h2 className="text-xl font-semibold">Security</h2>
          <div className="mt-3 space-y-3">
            <PasswordField
              label="Current password"
              value={passwords.currentPassword}
              onChange={(currentPassword) => setPasswords({ ...passwords, currentPassword })}
            />
            <PasswordField
              label="New password"
              value={passwords.newPassword}
              onChange={(newPassword) => setPasswords({ ...passwords, newPassword })}
            />
            <PasswordField
              label="Confirm new password"
              value={passwords.confirm}
              onChange={(confirm) => setPasswords({ ...passwords, confirm })}
            />
          </div>
          <button className="mt-4 rounded border border-primary-500 px-5 py-2 font-semibold text-primary-600">
            Change password
          </button>
        </form>
        {message && (
          <p
            role={messageType === 'error' ? 'alert' : 'status'}
            className={`text-sm ${messageType === 'error' ? 'text-red-600' : 'text-green-700'}`}
          >
            {message}
          </p>
        )}
      </main>
    </Guard>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}
function PasswordField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {props.label}
      <input
        required
        minLength={8}
        type="password"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}
