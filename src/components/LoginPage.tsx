import React, { useState } from 'react';
import { SystemUser } from '../types/gate';
import { signIn, quickDemoLogin, DEMO_PRESETS } from '../services/authService';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  ShieldAlert, 
  LogIn, 
  Loader2, 
  Shield, 
  Coffee 
} from 'lucide-react';

interface LoginPageProps {
  users: SystemUser[];
  onLogin: (user: SystemUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const user = await signIn(cleanEmail, password);
      onLogin(user);
    } catch (err: unknown) {
      console.error('Sign in error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      
      // Clear, user-friendly error for wrong credentials
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/user-not-found') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('invalid-credential') ||
        msg.includes('INVALID_LOGIN_CREDENTIALS') ||
        msg.includes('wrong-password') ||
        msg.includes('user-not-found')
      ) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (msg.includes('auth/too-many-requests')) {
        setError('Too many failed login attempts. Please wait a moment and try again.');
      } else {
        setError('Invalid email or password. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePresetLogin = async (index: number) => {
    setError(null);
    setLoading(true);
    try {
      const user = await quickDemoLogin(index);
      onLogin(user);
    } catch (err: unknown) {
      console.error('Demo login error:', err);
      const preset = DEMO_PRESETS[index];
      const fallback = users.find(u => u.email.toLowerCase() === preset.email.toLowerCase()) || {
        id: `user-${preset.role.toLowerCase()}`,
        name: preset.name,
        badgeId: preset.badgeId,
        email: preset.email,
        role: preset.role,
        assignedGateId: 'all',
        status: 'active' as const,
        lastActive: 'Just now',
      };
      onLogin(fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header with Brand Emblem and "Sign in" heading */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#15803D] text-white shadow-sm mb-1">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Sign in
          </h1>
        </div>

        {/* Clean Login Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
          <form onSubmit={handleEmailAuthSubmit} className="space-y-4 text-sm">
            {/* Error Banner for wrong credentials */}
            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] flex items-center gap-2 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-gray-700 font-medium text-xs mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@campusgate.edu"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-gray-700 font-medium text-xs mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] text-sm"
                />
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white font-medium rounded-md shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Personnel Access */}
          <div className="pt-4 border-t border-gray-200 space-y-2">
            <div className="text-xs font-semibold text-gray-700">
              Demo Accounts:
            </div>

            <div className="space-y-1.5">
              {DEMO_PRESETS.map((preset, idx) => {
                const isSuperAdmin = preset.role === 'SUPER_ADMIN';
                const isCafe = preset.role === 'CAFETERIA';
                return (
                  <button
                    key={preset.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePresetLogin(idx)}
                    className="w-full flex items-center justify-between p-2.5 rounded-md bg-white hover:bg-gray-50 border border-gray-200 text-left transition-colors cursor-pointer group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                        {isSuperAdmin ? (
                          <Shield className="w-4 h-4 text-[#15803D]" />
                        ) : isCafe ? (
                          <Coffee className="w-4 h-4 text-gray-700" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                          <span>{preset.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 bg-gray-50 font-medium">
                            {preset.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {preset.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-[#15803D] font-medium shrink-0 ml-2">
                      Sign in →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-500">
          Campus Access Control · Role-Based Security
        </div>
      </div>
    </div>
  );
};
