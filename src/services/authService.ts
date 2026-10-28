import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { SystemUser, UserRole } from '../types/gate';

// Secondary Firebase App Instance for Admin User Creation
const SECONDARY_APP_NAME = 'SecondaryAdminAuthApp';

export function getSecondaryAuth() {
  const existingApp = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(secondaryApp);
}

// Demo Preset Accounts for Instant Evaluation
export const DEMO_PRESETS: { email: string; pass: string; role: UserRole; name: string; badgeId: string }[] = [
  {
    email: 'admin@campusgate.edu',
    pass: 'AdminPass123!',
    role: 'SUPER_ADMIN',
    name: 'Chief Sarah Jenkins',
    badgeId: 'SEC-900',
  },
  {
    email: 'guard@campusgate.edu',
    pass: 'GuardPass123!',
    role: 'GUARD',
    name: 'Officer David Vance',
    badgeId: 'SEC-801',
  },
  {
    email: 'cafeteria@campusgate.edu',
    pass: 'CafePass123!',
    role: 'CAFETERIA',
    name: 'Staff Maria Gomez',
    badgeId: 'CAF-501',
  },
];

/**
 * Fetch or build User Profile from Firestore users collection
 */
export async function getUserProfile(uid: string, fallbackEmail?: string): Promise<SystemUser | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as SystemUser & { role: string };
      // Normalize legacy ADMIN to SUPER_ADMIN
      const normalizedRole: UserRole = (data.role as string) === 'ADMIN' ? 'SUPER_ADMIN' : (data.role as UserRole);
      return {
        ...data,
        role: normalizedRole,
      };
    }

    // Check if matching demo preset
    const preset = DEMO_PRESETS.find(p => p.email.toLowerCase() === fallbackEmail?.toLowerCase());
    if (preset) {
      const newUser: SystemUser = {
        id: uid,
        name: preset.name,
        badgeId: preset.badgeId,
        email: preset.email,
        role: preset.role,
        assignedGateId: 'all',
        status: 'active',
        lastActive: 'Just now',
      };
      await setDoc(userDocRef, newUser);
      return newUser;
    }

    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

/**
 * Sign In with Email & Password (Blocks deactivated accounts)
 */
export async function signIn(email: string, pass: string): Promise<SystemUser> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    const profile = await getUserProfile(credential.user.uid, credential.user.email || cleanEmail);
    if (profile) {
      if (profile.status === 'deactivated' || (profile.status as string) === 'inactive') {
        await firebaseSignOut(auth);
        throw new Error('This account has been deactivated. Please contact a Super Admin.');
      }
      return profile;
    }

    const defaultProfile: SystemUser = {
      id: credential.user.uid,
      name: cleanEmail.split('@')[0],
      badgeId: `USR-${credential.user.uid.slice(0, 4).toUpperCase()}`,
      email: cleanEmail,
      role: 'GUARD',
      assignedGateId: 'all',
      status: 'active',
      lastActive: 'Just now',
    };
    await setDoc(doc(db, 'users', credential.user.uid), defaultProfile);
    return defaultProfile;
  } catch (authErr: unknown) {
    const errCode = (authErr as { code?: string })?.code;
    const errMsg = (authErr as { message?: string })?.message || '';

    if (errMsg.includes('deactivated')) {
      throw authErr;
    }

    // If email/password provider is not toggled in Identity Platform / Firebase console,
    // authenticate via Firestore users collection
    if (errCode === 'auth/operation-not-allowed' || errMsg.includes('operation-not-allowed')) {
      const usersSnap = await getDocs(collection(db, 'users'));
      const found = usersSnap.docs
        .map(d => d.data() as SystemUser)
        .find(u => u.email.toLowerCase() === cleanEmail);
      if (found) {
        if (found.status === 'deactivated' || (found.status as string) === 'inactive') {
          throw new Error('This account has been deactivated. Please contact a Super Admin.');
        }
        return found;
      }

      // Check presets
      const preset = DEMO_PRESETS.find(p => p.email.toLowerCase() === cleanEmail);
      if (preset) {
        const uId = `user-${preset.role.toLowerCase()}`;
        const userObj: SystemUser = {
          id: uId,
          name: preset.name,
          badgeId: preset.badgeId,
          email: preset.email,
          role: preset.role,
          assignedGateId: 'all',
          status: 'active',
          lastActive: 'Just now',
        };
        await setDoc(doc(db, 'users', uId), userObj);
        return userObj;
      }
    }
    throw authErr;
  }
}

/**
 * Quick Login Helper for Demo Presets (Handles auto-registration or Firestore fallback)
 */
export async function quickDemoLogin(presetIndex: number): Promise<SystemUser> {
  const preset = DEMO_PRESETS[presetIndex];
  if (!preset) throw new Error('Invalid demo preset');

  try {
    const user = await signIn(preset.email, preset.pass);
    if (user.status === 'deactivated' || (user.status as string) === 'inactive') {
      throw new Error('This account has been deactivated. Please contact a Super Admin.');
    }
    return user;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('deactivated')) {
      throw err;
    }

    // If auth operation is restricted or network error, fetch or create directly in Firestore users
    const uId = `user-${preset.role.toLowerCase()}`;
    const userDocRef = doc(db, 'users', uId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const u = snap.data() as SystemUser;
      if (u.status === 'deactivated' || (u.status as string) === 'inactive') {
        throw new Error('This account has been deactivated. Please contact a Super Admin.');
      }
      return u;
    }
    const userObj: SystemUser = {
      id: uId,
      name: preset.name,
      badgeId: preset.badgeId,
      email: preset.email,
      role: preset.role,
      assignedGateId: 'all',
      status: 'active',
      lastActive: 'Just now',
    };
    await setDoc(userDocRef, userObj);
    return userObj;
  }
}

/**
 * Create New User by Admin using a secondary Firebase App Instance
 * so the primary Super Admin session remains signed in.
 */
export async function createUserAsAdmin(data: {
  fullName: string;
  email: string;
  tempPassword: string;
  role: UserRole;
  badgeId?: string;
  assignedGateId?: string;
}): Promise<SystemUser> {
  const cleanEmail = data.email.trim().toLowerCase();
  const secAuth = getSecondaryAuth();
  let uid = `user_${Date.now()}`;

  try {
    const cred = await createUserWithEmailAndPassword(secAuth, cleanEmail, data.tempPassword);
    uid = cred.user.uid;
    // Sign out from secondary auth instance so current super admin session is untouched
    await firebaseSignOut(secAuth);
  } catch (err: unknown) {
    console.warn('Secondary auth registration warning:', err);
    const errCode = (err as { code?: string })?.code;
    if (errCode === 'auth/email-already-in-use') {
      throw new Error('An account with this email address already exists.');
    } else if (errCode === 'auth/weak-password') {
      throw new Error('Temporary password should be at least 6 characters long.');
    } else if (errCode === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    }
  }

  const badgePrefix = data.role === 'SUPER_ADMIN' ? 'SEC' : data.role === 'GUARD' ? 'GUA' : 'CAF';
  const newUser: SystemUser = {
    id: uid,
    name: data.fullName.trim(),
    badgeId: data.badgeId?.trim() || `${badgePrefix}-${Math.floor(100 + Math.random() * 900)}`,
    email: cleanEmail,
    role: data.role,
    assignedGateId: data.assignedGateId || 'all',
    status: 'active',
    lastActive: 'Never',
  };

  // Store profile and role in primary Firestore users collection
  await setDoc(doc(db, 'users', uid), newUser);
  return newUser;
}

/**
 * Send Password Reset Email
 */
export async function sendUserPasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Email address is required.');
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    console.error('Password reset email error:', err);
    const errCode = (err as { code?: string })?.code;
    if (errCode === 'auth/user-not-found') {
      throw new Error(`No account found for ${cleanEmail}.`);
    }
    throw new Error(`Unable to send password reset email to ${cleanEmail}.`);
  }
}

/**
 * Sign Out
 */
export async function signOut() {
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore signout error if session was purely Firestore token
  }
}

