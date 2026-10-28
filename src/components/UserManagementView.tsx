import React, { useState, useMemo } from 'react';
import { SystemUser, UserRole, GateLane } from '../types/gate';
import { 
  Shield, 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  UserCheck, 
  UserX, 
  Mail, 
  KeyRound,
  ShieldAlert,
  Search,
  Loader2,
  AlertTriangle,
  Lock,
  RefreshCw
} from 'lucide-react';

interface UserManagementViewProps {
  currentUser: SystemUser | null;
  users: SystemUser[];
  gates: GateLane[];
  onAddUser: (data: {
    fullName: string;
    email: string;
    tempPassword: string;
    role: UserRole;
    badgeId?: string;
    assignedGateId?: string;
  }) => Promise<void>;
  onUpdateUser: (id: string, updates: Partial<SystemUser>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  users,
  gates,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSendPasswordReset,
}) => {
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [role, setRole] = useState<UserRole>('GUARD');
  const [badgeId, setBadgeId] = useState('');
  const [assignedGateId, setAssignedGateId] = useState('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const showNotification = (msg: string, type: 'success' | 'warning' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Stats
  const activeUsersCount = useMemo(() => users.filter((u) => u.status === 'active' || (u.status as string) !== 'deactivated').length, [users]);
  const deactivatedUsersCount = useMemo(() => users.filter((u) => u.status === 'deactivated' || (u.status as string) === 'inactive').length, [users]);
  const superAdminCount = useMemo(() => users.filter((u) => u.role === 'SUPER_ADMIN').length, [users]);
  const guardCount = useMemo(() => users.filter((u) => u.role === 'GUARD').length, [users]);
  const cafeCount = useMemo(() => users.filter((u) => u.role === 'CAFETERIA').length, [users]);

  const filteredUsers = useMemo(() => {
    const lower = searchTerm.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower) ||
        u.badgeId.toLowerCase().includes(lower);

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;

      const isDeactivated = u.status === 'deactivated' || (u.status as string) === 'inactive';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isDeactivated) ||
        (statusFilter === 'deactivated' && isDeactivated);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // If user is not a Super Admin, block rendering
  if (!isSuperAdmin) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-10 text-center shadow-sm max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 text-[#DC2626] flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-xs text-gray-600 mt-2">
          User Management is restricted exclusively to <strong>SUPER_ADMIN</strong> role accounts.
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setModalError('Please enter the user full name.');
      return;
    }
    if (!cleanEmail) {
      setModalError('Please enter a valid email address.');
      return;
    }
    if (!tempPassword || tempPassword.length < 6) {
      setModalError('Temporary password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddUser({
        fullName: cleanName,
        email: cleanEmail,
        tempPassword,
        role,
        badgeId: badgeId.trim() || undefined,
        assignedGateId,
      });

      showNotification(`Created new user ${cleanName} with role ${role}.`);
      setFullName('');
      setEmail('');
      setTempPassword('');
      setBadgeId('');
      setRole('GUARD');
      setAssignedGateId('all');
      setIsAddUserOpen(false);
    } catch (err: unknown) {
      console.error('Create user error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create user account.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (user: SystemUser, newRole: UserRole) => {
    if (user.id === currentUser?.id) {
      showNotification('Notice: You cannot modify your own active Super Admin role.', 'warning');
      return;
    }

    try {
      await onUpdateUser(user.id, { role: newRole });
      showNotification(`Updated ${user.name}'s role to ${newRole}.`);
    } catch (err) {
      console.error('Failed to change role:', err);
      showNotification('Failed to update user role.', 'warning');
    }
  };

  const handleToggleDeactivation = async (user: SystemUser) => {
    if (user.id === currentUser?.id) {
      showNotification('You cannot deactivate your own account.', 'warning');
      return;
    }

    const isCurrentlyDeactivated = user.status === 'deactivated' || (user.status as string) === 'inactive';
    const nextStatus = isCurrentlyDeactivated ? 'active' : 'deactivated';

    try {
      await onUpdateUser(user.id, { status: nextStatus });
      if (nextStatus === 'deactivated') {
        showNotification(`Deactivated user ${user.name}. A deactivated user cannot sign in.`, 'warning');
      } else {
        showNotification(`Reactivated user account for ${user.name}.`);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      showNotification('Failed to update user status.', 'warning');
    }
  };

  const handleSendResetEmail = async (user: SystemUser) => {
    setResettingEmail(user.email);
    try {
      await onSendPasswordReset(user.email);
      showNotification(`Password reset email sent to ${user.email}.`);
    } catch (err: unknown) {
      console.error('Password reset email error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email.';
      showNotification(msg, 'warning');
    } finally {
      setResettingEmail(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-md border text-xs font-semibold flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-[#15803D]'
              : 'bg-red-50 border-red-200 text-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{notification.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-700 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#15803D]" />
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              User Management
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            SUPER_ADMIN console to list users, provision staff accounts, assign roles, deactivate access, and issue password reset emails.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddUserOpen(true);
            setModalError(null);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add User</span>
        </button>
      </div>

      {/* Role & Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Total Accounts</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{users.length}</div>
          <div className="text-[11px] text-gray-500 mt-1">{activeUsersCount} active · {deactivatedUsersCount} deactivated</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Super Admins</div>
          <div className="text-2xl font-black text-[#15803D] mt-1">{superAdminCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Full console access</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Perimeter Guards</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{guardCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Turnstile & scan terminal</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Cafeteria Staff</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{cafeCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Dining meal scan access</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-gray-500 uppercase">Deactivated</div>
          <div className="text-2xl font-black text-[#DC2626] mt-1">{deactivatedUsersCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Sign in blocked</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name, email, badge ID..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN ({superAdminCount})</option>
            <option value="GUARD">GUARD ({guardCount})</option>
            <option value="CAFETERIA">CAFETERIA ({cafeCount})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'deactivated')}
            className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active ({activeUsersCount})</option>
            <option value="deactivated">Deactivated ({deactivatedUsersCount})</option>
          </select>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          Showing <strong>{filteredUsers.length}</strong> of {users.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Badge ID</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No users match the search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isDeactivated = u.status === 'deactivated' || (u.status as string) === 'inactive';
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${isDeactivated ? 'bg-red-50/20' : ''}`}>
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                              u.role === 'SUPER_ADMIN'
                                ? 'bg-[#15803D] text-white'
                                : isDeactivated
                                ? 'bg-red-100 text-[#DC2626]'
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}
                          >
                            {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-green-50 border border-green-200 text-[#15803D] px-1.5 py-0.2 rounded font-semibold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-normal">
                              Assigned: {u.assignedGateId === 'all' ? 'All Lanes' : u.assignedGateId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Badge ID */}
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-800">
                        <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {u.badgeId}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-gray-600 font-medium">
                        {u.email}
                      </td>

                      {/* Edit Role Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                          className={`text-xs font-bold px-2 py-1 rounded border cursor-pointer focus:outline-none transition-colors ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-green-50 border-green-300 text-[#15803D]'
                              : u.role === 'CAFETERIA'
                              ? 'bg-gray-100 border-gray-300 text-gray-800'
                              : 'bg-white border-gray-300 text-gray-800'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                          title={isSelf ? 'You cannot change your own role' : 'Change user role'}
                        >
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          <option value="GUARD">GUARD</option>
                          <option value="CAFETERIA">CAFETERIA</option>
                        </select>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isDeactivated ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 border border-red-200 text-[#DC2626]">
                            <UserX className="w-3 h-3" />
                            <span>DEACTIVATED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 border border-green-200 text-[#15803D]">
                            <UserCheck className="w-3 h-3" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {u.lastActive || 'Just now'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Password Reset Email */}
                          <button
                            type="button"
                            disabled={resettingEmail === u.email}
                            onClick={() => handleSendResetEmail(u)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                            title={`Send password reset email to ${u.email}`}
                          >
                            {resettingEmail === u.email ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
                            ) : (
                              <KeyRound className="w-3.5 h-3.5 text-[#15803D]" />
                            )}
                            <span className="hidden lg:inline">Reset Password</span>
                          </button>

                          {/* Deactivate / Reactivate Toggle */}
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => handleToggleDeactivation(u)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer border ${
                              isDeactivated
                                ? 'bg-green-50 border-green-300 text-[#15803D] hover:bg-green-100'
                                : 'bg-red-50 border-red-200 text-[#DC2626] hover:bg-red-100'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={isSelf ? 'You cannot deactivate yourself' : isDeactivated ? 'Reactivate User' : 'Deactivate User'}
                          >
                            {isDeactivated ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Reactivate</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Deactivate</span>
                              </>
                            )}
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => {
                              if (window.confirm(`Permanently delete account profile for ${u.name}?`)) {
                                onDeleteUser(u.id);
                                showNotification(`Deleted account ${u.name}.`);
                              }
                            }}
                            className="p-1.5 rounded text-gray-400 hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isSelf ? 'You cannot delete yourself' : 'Delete user profile'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD USER (With Secondary App Creation) */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl max-w-md w-full text-gray-900 max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <div>
                <h3 className="font-bold text-base text-gray-900">Add New User Account</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Creates Firebase Auth credentials via secondary instance and stores profile in users collection.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] flex items-center gap-2 font-medium text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Officer Marcus Cole"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m.cole@campusgate.edu"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              {/* Temporary Password */}
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">
                  Temporary Password * (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              {/* Role Dropdown */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 font-semibold focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="GUARD">GUARD</option>
                    <option value="CAFETERIA">CAFETERIA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">
                    Badge ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
              </div>

              {/* Assigned Lane */}
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">
                  Assigned Terminal / Lane
                </label>
                <select
                  value={assignedGateId}
                  onChange={(e) => setAssignedGateId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="all">All Access Lanes</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4.5 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white font-semibold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Add User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
