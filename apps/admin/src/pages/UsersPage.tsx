import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  UserPlus,
  Edit,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
  Shield,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth-store';

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  accountType: 'STAFF' | 'READER';
  createdAt: string;
  userRoles: {
    role: { id: string; name: string; description?: string };
  }[];
  _count?: { authoredArticles: number };
}

interface UsersResponse {
  data: UserItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageUsers = hasPermission('user.manage');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [accountType, setAccountType] = useState<'STAFF' | 'READER'>('STAFF');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: roles = [] } = useQuery<RoleItem[]>({
    queryKey: ['roles-list'],
    queryFn: () => apiFetch('/users/roles'),
  });

  const { data, isLoading, isError, refetch } = useQuery<UsersResponse>({
    queryKey: ['users-admin', page, search, roleFilter, statusFilter],
    queryFn: () =>
      apiFetch<UsersResponse>(
        `/users?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}${
          roleFilter ? `&roleId=${roleFilter}` : ''
        }${statusFilter ? `&status=${statusFilter}` : ''}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      password: string;
      roleId: string;
      status: string;
      accountType: string;
    }) => apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to create user'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      email?: string;
      password?: string;
      roleId?: string;
      status?: string;
    }) => apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
      closeModal();
    },
    onError: (err: unknown) => {
      setFormError(getApiErrorMessage(err, 'Failed to update user'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-admin'] });
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err, 'Failed to suspend user'));
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRoleId(roles[0]?.id || '');
    setStatus('ACTIVE');
    setAccountType('STAFF');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRoleId(u.userRoles[0]?.role?.id || '');
    setStatus(u.status);
    setAccountType(u.accountType);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('User name is required');
      return;
    }
    if (!email.trim()) {
      setFormError('Valid email is required');
      return;
    }
    if (!editingUser && (!password || password.length < 8)) {
      setFormError('Password must be at least 8 characters long');
      return;
    }
    if (!roleId) {
      setFormError('A role must be assigned to the user');
      return;
    }

    if (editingUser) {
      const payload: {
        name: string;
        email: string;
        roleId: string;
        status: string;
        password?: string;
      } = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        roleId,
        status,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      updateMutation.mutate({ id: editingUser.id, ...payload });
    } else {
      createMutation.mutate({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        roleId,
        status,
        accountType,
      });
    }
  };

  const handleSuspend = (u: UserItem) => {
    if (u.id === currentUser?.id) {
      alert('You cannot suspend your own account.');
      return;
    }
    if (confirm(`Are you sure you want to suspend access for ${u.name}?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  const users = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1, total: 0 };

  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'Super Admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Admin':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Editor-in-Chief':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Editor':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'Reporter':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Photographer':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <UsersIcon className="h-6 w-6 text-primary-500" />
            Users & Newsroom Staff
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage editors, reporters, contributors, and role-based permissions.
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
          >
            <UserPlus className="h-4 w-4" />
            Add Staff Member
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name or email address..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>

        <button
          onClick={() => refetch()}
          title="Refresh"
          className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading user accounts...</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load users. Please try again.</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No users match your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Articles</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Account Type</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Joined</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => {
                  const roleName = u.userRoles[0]?.role?.name || 'Reader';
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs uppercase">
                            {u.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-1.5">
                              {u.name}
                              {isSelf && (
                                <span className="rounded bg-gray-200 px-1.5 py-0.2 text-[10px] font-semibold text-gray-700">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                            roleName,
                          )}`}
                        >
                          <Shield className="h-3 w-3" />
                          {roleName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {u._count?.authoredArticles || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                        {u.accountType}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : u.status === 'SUSPENDED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManageUsers && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit User & Permissions"
                              className="rounded p-1 text-gray-500 hover:text-primary-600 hover:bg-gray-100"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleSuspend(u)}
                                title="Suspend Account"
                                className="rounded p-1 text-gray-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-500">
              Showing page {meta.page} of {meta.totalPages} ({meta.total} users)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Edit User & Permissions' : 'Add Staff Member'}
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
                <label className="block text-sm font-medium text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mahfuz Anam, Nazmul Hasan"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="journalist@bdnews.com"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 flex items-center justify-between">
                  <span>
                    {editingUser ? 'Reset Password (optional)' : 'Temporary Password'}{' '}
                    {!editingUser && <span className="text-red-500">*</span>}
                  </span>
                  <KeyRound className="h-3.5 w-3.5 text-gray-400" />
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? 'Leave blank to keep unchanged' : 'Min 8 characters'}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role Assignment <span className="text-red-500">*</span>
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Select a role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `(${r.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={accountType}
                    disabled={!!editingUser}
                    onChange={(e) => setAccountType(e.target.value as 'STAFF' | 'READER')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100"
                  >
                    <option value="STAFF">STAFF</option>
                    <option value="READER">READER</option>
                  </select>
                </div>
              </div>

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
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

