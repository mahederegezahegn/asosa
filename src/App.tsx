import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Student, 
  GateLane, 
  GateScanLog, 
  MealLog,
  MealCard,
  MealPeriodName,
  SystemSettings, 
  GateDirection, 
  ScanResultType,
  SystemUser,
  UserRole
} from './types/gate';
import { 
  INITIAL_STUDENTS, 
  INITIAL_GATES, 
  INITIAL_LOGS, 
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_MEAL_CARDS
} from './data/mockData';
import { gateAudio } from './utils/audio';
import { LoginPage } from './components/LoginPage';
import { AttractiveScanTerminal } from './components/AttractiveScanTerminal';
import { StudentDisplayCard } from './components/StudentDisplayCard';
import { ScanTerminalRightColumn } from './components/ScanTerminalRightColumn';
import { BarcodeScannerInput } from './components/BarcodeScannerInput';
import { CafeteriaScanPage, CafeteriaScanResult } from './components/CafeteriaScanPage';
import { StudentDirectory } from './components/StudentDirectory';
import { MonitoringPage } from './components/MonitoringPage';
import { GateSettings, SettingsSection } from './components/GateSettings';
import { StudentCardBadge } from './components/StudentCardBadge';
import { MealCardsView } from './components/MealCardsView';
import { UserManagementView } from './components/UserManagementView';
import { getActiveMealPeriod } from './utils/mealUtils';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { 
  seedInitialDataIfEmpty,
  executeGateScanTransaction,
  executeMealScanTransaction,
  subscribeToMealCards,
  createMealCard,
  updateMealCard,
  replaceMealCard,
  batchIssueMealCards,
  createStudent,
  batchCreateStudents,
  updateStudent,
  deleteStudent,
  createScanPoint,
  updateScanPoint,
  deleteScanPoint,
  updateSystemSettings,
  updateUserProfile,
  deleteUserProfile
} from './services/gateService';
import { getUserProfile, signOut as authSignOut, createUserAsAdmin, sendUserPasswordResetEmail } from './services/authService';
import { 
  ShieldCheck, 
  ScanLine, 
  Users, 
  UserPlus,
  Activity, 
  Settings as SettingsIcon, 
  ShieldAlert, 
  LogOut,
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Utensils,
  Menu,
  X,
  CreditCard,
  Shield,
  Coffee,
  ChevronDown,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX
} from 'lucide-react';

export type PageId = 
  | 'login' 
  | 'dashboard' 
  | 'students' 
  | 'meal_cards' 
  | 'users' 
  | 'terminal' 
  | 'cafeteria_scan' 
  | 'settings';

export const ROLE_ALLOWED_PAGES: Record<UserRole, PageId[]> = {
  SUPER_ADMIN: ['dashboard', 'students', 'meal_cards', 'users', 'terminal', 'cafeteria_scan', 'settings'],
  GUARD: ['dashboard', 'terminal'],
  CAFETERIA: ['cafeteria_scan'],
};

export const getFirstPageForRole = (role: UserRole | 'ADMIN' | string): PageId => {
  if (role === 'CAFETERIA') return 'cafeteria_scan';
  if (role === 'GUARD') return 'dashboard';
  return 'dashboard'; // SUPER_ADMIN
};

export default function App() {
  // Authentication & Session with LocalStorage persistence across page reloads
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = localStorage.getItem('campusgate_session_user');
      if (saved) {
        const u = JSON.parse(saved);
        if ((u.role as unknown as string) === 'ADMIN') u.role = 'SUPER_ADMIN';
        return u;
      }
    } catch {}
    return null;
  });
  const [authInitialized, setAuthInitialized] = useState(false);

  // Users list from Firestore
  const [users, setUsers] = useState<SystemUser[]>(INITIAL_USERS);

  // Active page state with role enforcement
  const [currentPage, setCurrentPage] = useState<PageId>(() => {
    try {
      const savedUser = localStorage.getItem('campusgate_session_user');
      const savedPage = localStorage.getItem('campusgate_active_page') as PageId;
      if (savedUser) {
        const u: SystemUser = JSON.parse(savedUser);
        const role = ((u.role as unknown as string) === 'ADMIN' ? 'SUPER_ADMIN' : u.role) as UserRole;
        const allowed = ROLE_ALLOWED_PAGES[role] || ['dashboard'];
        if (savedPage && allowed.includes(savedPage)) {
          return savedPage;
        }
        return getFirstPageForRole(role);
      }
    } catch {}
    return 'login';
  });

  // Live Firestore State (Persists across reloads)
  const [students, setStudents] = useState<Student[]>([]);
  const [gates, setGates] = useState<GateLane[]>(INITIAL_GATES);
  const [logs, setLogs] = useState<GateScanLog[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [mealCards, setMealCards] = useState<MealCard[]>(INITIAL_MEAL_CARDS);
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('policies');
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(true);

  // Current selected active gate lane in terminal
  const [currentGateId, setCurrentGateId] = useState<string>('gate-01');

  const activeGate = useMemo(() => {
    return gates.find((g) => g.id === currentGateId) || gates[0] || INITIAL_GATES[0];
  }, [gates, currentGateId]);

  // Active Lane for Scan Terminal (Only Lane A and Lane B)
  const [activeLane, setActiveLane] = useState<'Lane A' | 'Lane B'>('Lane A');

  // Terminal Direction (Inbound vs Outbound)
  const [laneDirection, setLaneDirection] = useState<GateDirection>('ENTRY');

  // Cafeteria Mode toggle & meal period state (auto-selected by schedule, manually changeable)
  const [isCafeteriaMode, setIsCafeteriaMode] = useState<boolean>(false);
  const [mealType, setMealType] = useState<MealPeriodName>(() => getActiveMealPeriod(INITIAL_SETTINGS.mealPeriods));

  // Physical Gate Barrier Live States
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gateRemainingSeconds, setGateRemainingSeconds] = useState(0);

  // Gate Scan Telemetry for Large Student Display Card
  const [lastScanResult, setLastScanResult] = useState<{
    result: ScanResultType;
    message: string;
    details?: string;
    student?: Student;
    timestamp: string;
    barcode?: string;
    direction?: GateDirection;
  } | null>(null);

  // Dedicated Cafeteria Scan Result
  const [cafeteriaScanResult, setCafeteriaScanResult] = useState<CafeteriaScanResult | null>(null);

  // Selected Student for ID Badge Inspection modal
  const [badgeModalStudent, setBadgeModalStudent] = useState<Student | null>(null);

  // Role Restriction Notice
  const [permissionBanner, setPermissionBanner] = useState<string | null>(null);

  // Mobile sidebar drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scan Terminal Fullscreen Kiosk Mode
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Sync audio engine enabled state
  useEffect(() => {
    gateAudio.enabled = !isAudioMuted;
  }, [isAudioMuted]);

  const toggleTerminalFullscreen = useCallback(() => {
    if (!isTerminalFullscreen) {
      setIsTerminalFullscreen(true);
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsTerminalFullscreen(false);
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isTerminalFullscreen]);

  // Fullscreen escape key and fullscreenchange listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTerminalFullscreen) {
        setIsTerminalFullscreen(false);
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isTerminalFullscreen) {
        setIsTerminalFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isTerminalFullscreen]);

  // Roles calculation
  const userRole = ((currentUser?.role as unknown as string) === 'ADMIN' ? 'SUPER_ADMIN' : currentUser?.role) as UserRole | undefined;
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isGuard = userRole === 'GUARD';
  const isCafeteria = userRole === 'CAFETERIA';

  // Persist session to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('campusgate_session_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('campusgate_session_user');
    }
  }, [currentUser]);

  // Persist active page to localStorage
  useEffect(() => {
    localStorage.setItem('campusgate_active_page', currentPage);
  }, [currentPage]);

  // 1. Initialize Firebase & Listen to Auth State
  useEffect(() => {
    // Seed initial collections if empty
    seedInitialDataIfEmpty().catch((err) => {
      console.warn('Initial seed check:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const profile = await getUserProfile(fbUser.uid, fbUser.email || undefined);
          if (profile) {
            if (profile.status === 'deactivated' || (profile.status as string) === 'inactive') {
              await authSignOut();
              setCurrentUser(null);
              setCurrentPage('login');
              setPermissionBanner('Account Deactivated: This account has been deactivated by a Super Admin.');
              setAuthInitialized(true);
              return;
            }
            const normRole: UserRole = (profile.role as string) === 'ADMIN' ? 'SUPER_ADMIN' : profile.role;
            const normProfile: SystemUser = { ...profile, role: normRole };
            setCurrentUser(normProfile);
            if (normRole === 'CAFETERIA') {
              setIsCafeteriaMode(true);
            }
            if (currentPage === 'login') {
              const firstPage = getFirstPageForRole(normRole);
              setCurrentPage(firstPage);
              if (firstPage === 'cafeteria_scan') {
                setIsCafeteriaMode(true);
                const mealGate = gates.find((g) => g.type === 'MEAL');
                if (mealGate) setCurrentGateId(mealGate.id);
              }
            }
          } else {
            const isSuper = fbUser.email === 'admin@campusgate.edu' || fbUser.email === 'tigistoljira9@gmail.com';
            const role: UserRole = isSuper ? 'SUPER_ADMIN' : 'GUARD';
            const fallbackProfile: SystemUser = {
              id: fbUser.uid,
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Officer',
              badgeId: `SEC-${fbUser.uid.slice(0, 4).toUpperCase()}`,
              email: fbUser.email || '',
              role,
              assignedGateId: 'all',
              status: 'active',
              lastActive: 'Just now',
            };
            await setDoc(doc(db, 'users', fbUser.uid), fallbackProfile);
            setCurrentUser(fallbackProfile);
            if (currentPage === 'login') {
              setCurrentPage(getFirstPageForRole(role));
            }
          }
        } catch (err) {
          console.error('Error fetching user on auth change:', err);
        }
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  // 2. Role Access Enforcement Guard
  // Redirect each role to its first page if attempting to access unauthorized views
  useEffect(() => {
    if (!currentUser) return;
    const role: UserRole = (currentUser.role as string) === 'ADMIN' ? 'SUPER_ADMIN' : currentUser.role;
    const allowed = ROLE_ALLOWED_PAGES[role] || ['dashboard'];

    if (currentPage !== 'login' && !allowed.includes(currentPage)) {
      const firstPage = getFirstPageForRole(role);
      setCurrentPage(firstPage);
      if (firstPage === 'cafeteria_scan') {
        setIsCafeteriaMode(true);
        const mealGate = gates.find((g) => g.type === 'MEAL');
        if (mealGate) setCurrentGateId(mealGate.id);
      }
      setPermissionBanner(
        `Access Denied: The ${role} role is not authorized for that section. Redirected to ${firstPage.replace('_', ' ').toUpperCase()}.`
      );
    }
  }, [currentUser, currentPage, gates]);

  // 3. Live Firestore Listeners for Data Persistence across reloads
  useEffect(() => {
    const q = collection(db, 'students');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: Student[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as Student);
        });
        items.sort((a, b) => a.id.localeCompare(b.id));
        setStudents(items);
      },
      (err) => {
        console.warn('Students snapshot warning:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = collection(db, 'scanPoints');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: GateLane[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as GateLane);
        });
        if (items.length > 0) {
          items.sort((a, b) => a.code.localeCompare(b.code));
          setGates(items);
        }
      },
      (err) => {
        console.warn('ScanPoints snapshot warning:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = collection(db, 'scanLogs');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: GateScanLog[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as GateScanLog);
        });
        items.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setLogs(items);
      },
      (err) => {
        console.warn('ScanLogs snapshot warning:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = collection(db, 'mealLogs');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: MealLog[] = [];
        snapshot.forEach((d) => {
          items.push(d.data() as MealLog);
        });
        items.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setMealLogs(items);
      },
      (err) => {
        console.warn('MealLogs snapshot warning:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = collection(db, 'settings');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data() as SystemSettings;
          setSettings(docData);
          if (docData.mealPeriods) {
            setMealType(getActiveMealPeriod(docData.mealPeriods));
          }
        }
      },
      (err) => {
        console.warn('Settings snapshot warning:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToMealCards((cards) => {
      if (cards && cards.length > 0) {
        setMealCards(cards);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = collection(db, 'users');
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: SystemUser[] = [];
        snapshot.forEach((d) => {
          const u = d.data() as SystemUser;
          if (u.role === ('ADMIN' as unknown as UserRole)) {
            u.role = 'SUPER_ADMIN';
          }
          items.push(u);
        });
        if (items.length > 0) {
          setUsers(items);

          if (currentUser) {
            const match = items.find((u) => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
            if (match && (match.status === 'deactivated' || (match.status as string) === 'inactive')) {
              authSignOut();
              setCurrentUser(null);
              setCurrentPage('login');
              setPermissionBanner('Account Deactivated: Your user account has been deactivated by a Super Admin.');
            }
          }
        }
      },
      (err) => {
        console.warn('Users snapshot warning:', err);
      }
    );
    return () => unsub();
  }, [currentUser]);

  // Audio Sync
  useEffect(() => {
    gateAudio.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Handle gate auto-relock countdown timer
  useEffect(() => {
    if (!isGateOpen || settings.emergencyEgressMode) return;

    const interval = setInterval(() => {
      setGateRemainingSeconds((prev) => {
        if (prev <= 0.2) {
          setIsGateOpen(false);
          return 0;
        }
        return prev - 0.2;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isGateOpen, settings.emergencyEgressMode]);

  // Sync gate direction and mode when active gate changes
  useEffect(() => {
    if (activeGate?.allowedDirection === 'ENTRY') {
      setLaneDirection('ENTRY');
    } else if (activeGate?.allowedDirection === 'EXIT') {
      setLaneDirection('EXIT');
    }

    if (activeGate?.type === 'MEAL' || currentPage === 'cafeteria_scan') {
      setIsCafeteriaMode(true);
    }
  }, [activeGate, currentPage]);

  // Sync active meal period from settings
  useEffect(() => {
    const currentPeriod = getActiveMealPeriod(settings.mealPeriods);
    setMealType(currentPeriod);
  }, [settings.mealPeriods]);

  // LOGIN & LOGOUT HANDLERS
  const handleLogin = (user: SystemUser) => {
    const normRole: UserRole = (user.role as string) === 'ADMIN' ? 'SUPER_ADMIN' : user.role;
    const userWithNormRole = { ...user, role: normRole };
    setCurrentUser(userWithNormRole);

    const targetPage = getFirstPageForRole(normRole);
    if (targetPage === 'cafeteria_scan') {
      setIsCafeteriaMode(true);
      const mealGate = gates.find((g) => g.type === 'MEAL');
      if (mealGate) setCurrentGateId(mealGate.id);
    } else if (targetPage === 'terminal') {
      setIsCafeteriaMode(false);
      const normalGate = gates.find((g) => g.type !== 'MEAL');
      if (normalGate) setCurrentGateId(normalGate.id);
    }
    setCurrentPage(targetPage);
    setPermissionBanner(null);
  };

  const handleLogout = async () => {
    try {
      await authSignOut();
    } catch (err) {
      console.warn('Sign out:', err);
    }
    setCurrentUser(null);
    setCurrentPage('login');
    setPermissionBanner(null);
  };

  // Safe Navigation Handler with RBAC checks
  const handleNavigate = (page: PageId) => {
    setPermissionBanner(null);
    if (!currentUser) {
      setCurrentPage('login');
      return;
    }

    const role: UserRole = (currentUser.role as string) === 'ADMIN' ? 'SUPER_ADMIN' : currentUser.role;
    const allowed = ROLE_ALLOWED_PAGES[role] || ['dashboard'];

    if (!allowed.includes(page)) {
      setPermissionBanner(
        `Permission Denied: Accounts with role "${role}" cannot open that view. Allowed views: ${allowed.map(p => p.replace('_', ' ').toUpperCase()).join(', ')}.`
      );
      return;
    }

    if (page === 'cafeteria_scan') {
      setIsCafeteriaMode(true);
      const mealGate = gates.find((g) => g.type === 'MEAL');
      if (mealGate) setCurrentGateId(mealGate.id);
    } else if (page === 'terminal') {
      setIsCafeteriaMode(false);
      const normalGate = gates.find((g) => g.type !== 'MEAL');
      if (normalGate) setCurrentGateId(normalGate.id);
    }

    setCurrentPage(page);
  };

  // CORE SCAN LOGIC INSIDE FIRESTORE TRANSACTION
  const handleBarcodeScan = useCallback(async (barcodeInput: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const cleanCode = barcodeInput.trim().toUpperCase();

    // Emergency Egress Check
    if (settings.emergencyEgressMode) {
      gateAudio.playAccessGranted();
      setIsGateOpen(true);
      setGateRemainingSeconds(settings.gateRelockSeconds);
      setIsProcessing(false);
      return;
    }

    try {
      // If on cafeteria_scan page or user role is CAFETERIA
      if (currentPage === 'cafeteria_scan' || currentUser?.role === 'CAFETERIA') {
        const mealRes = await executeMealScanTransaction(
          cleanCode,
          mealType,
          activeGate?.id || 'meal-01',
          activeGate?.name || 'Central Dining Hall',
          currentUser?.id
        );

        if (mealRes.status === 'GRANTED') {
          gateAudio.playAccessGranted();
          setIsGateOpen(true);
          setGateRemainingSeconds(settings.gateRelockSeconds);
          setCafeteriaScanResult({
            status: 'GRANTED',
            message: mealRes.message,
            details: mealRes.reason,
            student: mealRes.student,
            timestamp: mealRes.timestamp,
            cardNumber: mealRes.cardNumber || cleanCode,
            mealType,
          });
        } else if (mealRes.status === 'WARNING') {
          // Clear WARNING: "Already served" - student name and photo displayed
          gateAudio.playWarningPassback();
          setIsGateOpen(false);
          setCafeteriaScanResult({
            status: 'WARNING',
            message: 'Already served',
            details: mealRes.reason,
            student: mealRes.student,
            timestamp: mealRes.timestamp,
            cardNumber: mealRes.cardNumber || cleanCode,
            mealType,
          });
        } else {
          // Denied (unregistered card, blocked card, suspended, expired, or meal ineligible)
          gateAudio.playAccessDenied();
          setIsGateOpen(false);
          setCafeteriaScanResult({
            status: 'DENIED',
            message: mealRes.message,
            details: mealRes.reason,
            student: mealRes.student,
            timestamp: mealRes.timestamp,
            cardNumber: mealRes.cardNumber || cleanCode,
            mealType,
          });
        }
        setIsProcessing(false);
        return;
      }

      const targetGateId = activeLane === 'Lane A' ? 'gate-01' : 'gate-02';
      const targetGateName = activeLane;

      // Execute Gate Scan Transaction in Firestore
      const res = await executeGateScanTransaction(
        cleanCode,
        targetGateId,
        targetGateName,
        laneDirection,
        currentUser?.id
      );

      // Acoustic reaction
      if (res.result === 'ALLOWED' || res.result === 'GRANTED') {
        gateAudio.playAccessGranted();
      } else if (res.result === 'WARNING') {
        gateAudio.playWarningPassback();
      } else {
        gateAudio.playAccessDenied();
      }

      setLastScanResult({
        result: res.result,
        message: res.message,
        details: res.reason,
        student: res.student,
        timestamp: res.timestamp,
        barcode: cleanCode,
        direction: laneDirection,
      });
    } catch (err) {
      console.error('Scan transaction failure:', err);
      gateAudio.playAccessDenied();
      setLastScanResult({
        result: 'DENIED_UNREGISTERED',
        message: 'Transaction Error',
        details: err instanceof Error ? err.message : 'Database transaction aborted',
        timestamp: new Date().toISOString(),
        barcode: cleanCode,
        direction: laneDirection,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, settings, activeGate, activeLane, laneDirection, currentUser, isCafeteriaMode, mealType, currentPage]);

  const handleResetDemoData = async () => {
    try {
      for (const stu of INITIAL_STUDENTS) {
        await createStudent(stu);
      }
      for (const g of INITIAL_GATES) {
        await createScanPoint(g);
      }
      await updateSystemSettings(INITIAL_SETTINGS);
      setIsGateOpen(false);
      setLastScanResult(null);
    } catch (err) {
      console.error('Error restoring demo data:', err);
    }
  };

  // Student CRUD
  const handleAddStudent = async (newStudent: Student) => {
    try {
      await createStudent(newStudent);
    } catch (err) {
      console.error('Failed to create student:', err);
    }
  };

  const handleUpdateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      await updateStudent(id, updates);
    } catch (err) {
      console.error('Failed to update student:', err);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudent(id);
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  // Gates CRUD
  const handleAddGate = async (newGateData: Omit<GateLane, 'id' | 'totalEntriesToday' | 'totalExitsToday'>) => {
    try {
      const newGate: GateLane = {
        ...newGateData,
        id: `gate-${Date.now()}`,
        totalEntriesToday: 0,
        totalExitsToday: 0,
      };
      await createScanPoint(newGate);
    } catch (err) {
      console.error('Failed to create gate:', err);
    }
  };

  const handleUpdateGate = async (id: string, updates: Partial<GateLane>) => {
    try {
      await updateScanPoint(id, updates);
    } catch (err) {
      console.error('Failed to update gate:', err);
    }
  };

  const handleDeleteGate = async (id: string) => {
    try {
      await deleteScanPoint(id);
      if (currentGateId === id && gates.length > 1) {
        const nextGate = gates.find((g) => g.id !== id);
        if (nextGate) setCurrentGateId(nextGate.id);
      }
    } catch (err) {
      console.error('Failed to delete gate:', err);
    }
  };

  // Users CRUD
  const handleAddUser = async (newUserData: Omit<SystemUser, 'id' | 'lastActive'>) => {
    try {
      const newUser: SystemUser = {
        ...newUserData,
        id: `user-${Date.now()}`,
        lastActive: 'Just now',
      };
      await updateUserProfile(newUser.id, newUser);
    } catch (err) {
      console.error('Failed to add user:', err);
    }
  };

  const handleAddUserAsAdmin = async (data: {
    fullName: string;
    email: string;
    tempPassword: string;
    role: UserRole;
    badgeId?: string;
    assignedGateId?: string;
  }) => {
    await createUserAsAdmin(data);
  };

  const handleSendPasswordReset = async (email: string) => {
    await sendUserPasswordResetEmail(email);
  };

  const handleUpdateUser = async (id: string, updates: Partial<SystemUser>) => {
    try {
      await updateUserProfile(id, updates);
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUserProfile(id);
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  // If not logged in, render clean light theme LoginPage
  if (!currentUser || currentPage === 'login') {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans">
        <LoginPage
          users={users}
          onLogin={handleLogin}
        />
      </div>
    );
  }

  // Get human-friendly page title for the top bar
  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return isGuard ? 'Guard Dashboard · Perimeter Summary' : 'Campus Security Dashboard & Monitoring';
      case 'students':
        return 'Student Credentials & Directory';
      case 'meal_cards':
        return 'Student Meal Cards & Subscriptions';
      case 'users':
        return 'User & Operator Management';
      case 'terminal':
        return `Scan Terminal · ${activeLane}`;
      case 'cafeteria_scan':
        return activeGate ? `Cafeteria Scan · ${activeGate.name}` : 'Cafeteria Scan Terminal';
      case 'settings':
        return 'Access Control Settings & Policies';
      default:
        return 'Console';
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex font-sans">
      {/* 
        MANDATORY SPEC: Fixed Left Sidebar
        Green background (#15803D), white text, icons with labels
        Sidebar items strictly per role:
        - SUPER_ADMIN: Dashboard, Students, Meal Cards, User Management, Scan Terminal, Cafeteria Scan, Settings.
        - GUARD: Dashboard (summary cards only) and Scan Terminal.
        - CAFETERIA: Cafeteria Scan only.
      */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#15803D] text-white flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Institutional Brand Wordmark */}
          <div className="p-5 border-b border-white/15 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-white/15 flex items-center justify-center text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                  CampusGate
                </h1>
                <p className="text-[11px] text-white/75 font-medium leading-none mt-0.5">
                  Campus Access Control
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-white/80 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Navigation Items (Strictly per user role) */}
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
            {/* SUPER_ADMIN NAVIGATION */}
            {isSuperAdmin && (
              <>
                {/* 1. Dashboard */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'dashboard'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>

                {/* 2. Students */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('students');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'students'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Students</span>
                </button>

                {/* 3. Meal Cards */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('meal_cards');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'meal_cards'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" />
                  <span>Meal Cards</span>
                </button>

                {/* 4. User Management */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('users');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'users'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>User Management</span>
                </button>

                {/* 5. Scan Terminal */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('terminal');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'terminal'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <ScanLine className="w-4 h-4 shrink-0" />
                  <span>Scan Terminal</span>
                </button>

                {/* 6. Cafeteria Scan */}
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('cafeteria_scan');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'cafeteria_scan'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Utensils className="w-4 h-4 shrink-0" />
                  <span>Cafeteria Scan</span>
                </button>

                {/* 7. Settings with Sidebar Dropdown Sub-menu */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleNavigate('settings');
                      setSettingsDropdownOpen((prev) => !prev);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                      currentPage === 'settings'
                        ? 'bg-[#166534] text-white shadow-xs'
                        : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <SettingsIcon className="w-4 h-4 shrink-0" />
                      <span>Settings</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${settingsDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Sidebar Settings Dropdown Sub-options */}
                  {settingsDropdownOpen && (
                    <div className="pl-6 space-y-1 py-1 border-l-2 border-white/20 ml-4">
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('settings');
                          setSettingsSection('policies');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                          currentPage === 'settings' && settingsSection === 'policies'
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span>Security Policies</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('settings');
                          setSettingsSection('scan_points');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                          currentPage === 'settings' && settingsSection === 'scan_points'
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span>Scan Points (Lanes)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleNavigate('settings');
                          setSettingsSection('meal_periods');
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
                          currentPage === 'settings' && settingsSection === 'meal_periods'
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span>Meal Periods</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* GUARD NAVIGATION: Dashboard (summary cards only) and Scan Terminal */}
            {isGuard && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'dashboard'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('terminal');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'terminal'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <ScanLine className="w-4 h-4 shrink-0" />
                  <span>Scan Terminal</span>
                </button>
              </>
            )}

            {/* CAFETERIA NAVIGATION: Cafeteria Scan only */}
            {isCafeteria && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleNavigate('cafeteria_scan');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                    currentPage === 'cafeteria_scan'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-white/85 hover:bg-[#166534]/60 hover:text-white'
                  }`}
                >
                  <Utensils className="w-4 h-4 shrink-0" />
                  <span>Cafeteria Scan</span>
                </button>
              </>
            )}
          </nav>

          {/* Sidebar Footer Information */}
          <div className="p-4 border-t border-white/15 space-y-2">
            {settings.emergencyEgressMode && (
              <div className="p-2.5 rounded bg-[#DC2626] text-white text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>EMERGENCY FREE EGRESS</span>
              </div>
            )}
            <div className="text-[11px] text-white/70">
              Role: <strong className="text-white">{currentUser.role}</strong>
            </div>
            <div className="text-[11px] text-white/70">
              Perimeter System v2.4 · Online
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
        />
      )}

      {/* Main Content Area (Offset for fixed left sidebar) */}
      <div className="md:pl-64 flex-1 flex flex-col min-h-screen bg-white">
        {/* 
          MANDATORY SPEC: White Top Bar
          Showing the signed-in user's name, role and a Sign out button.
        */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-16 px-3 sm:px-6 flex items-center justify-between shadow-xs">
          {/* Left Zone: Hamburger for Mobile + Current View Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer shrink-0"
              title="Toggle sidebar navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2 truncate">
                <span>{getPageTitle()}</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500 hidden sm:block truncate">
                Authorized Session: {currentUser.name} · Role: {currentUser.role}
              </p>
            </div>
          </div>

          {/* Right Zone: Controls, Signed-in User's Badge, and Sign Out Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Terminal Quick Fullscreen Button */}
            {currentPage === 'terminal' && (
              <button
                type="button"
                onClick={toggleTerminalFullscreen}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  isTerminalFullscreen
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-2xs'
                }`}
                title={isTerminalFullscreen ? 'Exit Full Screen' : 'Full Screen Kiosk Terminal'}
              >
                {isTerminalFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-amber-700" />
                    <span className="hidden md:inline">Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-[#15803D]" />
                    <span className="hidden md:inline">Full Screen Kiosk</span>
                  </>
                )}
              </button>
            )}

            {/* Audio Feedback Chime Toggle */}
            <button
              type="button"
              onClick={() => setIsAudioMuted((prev) => !prev)}
              className="p-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white transition-colors cursor-pointer"
              title={isAudioMuted ? 'Unmute turnstile chimes' : 'Mute turnstile chimes'}
            >
              {isAudioMuted ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#15803D]" />
              )}
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-xs">
              <div className="w-6 h-6 rounded bg-[#15803D] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                {currentUser.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="hidden lg:block text-left max-w-[120px] truncate">
                <div className="font-semibold text-gray-900 leading-tight truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-gray-500 font-medium leading-none mt-0.5 truncate">
                  {currentUser.badgeId}
                </div>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded border text-[#15803D] bg-green-50 border-green-200 uppercase">
                {currentUser.role}
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:text-[#DC2626] hover:border-red-300 hover:bg-red-50/50 bg-white transition-colors cursor-pointer"
              title="Sign out of console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Role Restriction Banner Warning */}
        {permissionBanner && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs text-[#DC2626]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{permissionBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setPermissionBanner(null)}
              className="text-gray-500 hover:text-gray-800 text-xs font-semibold cursor-pointer"
            >
              Dismiss ✕
            </button>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
          {/* 1. DASHBOARD VIEW (SUPER_ADMIN or GUARD) */}
          {currentPage === 'dashboard' && (isSuperAdmin || isGuard) && (
            <MonitoringPage
              students={students}
              logs={logs}
              gates={gates}
              mealLogs={mealLogs}
              summaryOnly={isGuard}
            />
          )}

          {/* 2. STUDENTS VIEW (SUPER_ADMIN Only) */}
          {currentPage === 'students' && isSuperAdmin && (
            <StudentDirectory
              students={students}
              onSelectStudentForBadge={(stu) => setBadgeModalStudent(stu)}
              onAddStudent={handleAddStudent}
              onBatchAddStudents={async (batch) => {
                await batchCreateStudents(batch);
              }}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onSimulateScan={(code) => {
                setCurrentPage('terminal');
                setTimeout(() => handleBarcodeScan(code), 200);
              }}
            />
          )}

          {/* 3. MEAL CARDS VIEW (SUPER_ADMIN Only) */}
          {currentPage === 'meal_cards' && isSuperAdmin && (
            <MealCardsView
              students={students}
              mealCards={mealCards}
              mealLogs={mealLogs}
              onUpdateStudent={handleUpdateStudent}
              onCreateMealCard={createMealCard}
              onUpdateMealCard={updateMealCard}
              onReplaceMealCard={replaceMealCard}
              onBulkIssueMealCards={batchIssueMealCards}
            />
          )}

          {/* 4. USER MANAGEMENT VIEW (SUPER_ADMIN Only) */}
          {currentPage === 'users' && isSuperAdmin && (
            <UserManagementView
              currentUser={currentUser}
              users={users}
              gates={gates}
              onAddUser={handleAddUserAsAdmin}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSendPasswordReset={handleSendPasswordReset}
            />
          )}

          {/* 5. SCAN TERMINAL: Redesigned Two-Column Terminal with Fullscreen Kiosk Mode */}
          {currentPage === 'terminal' && (isSuperAdmin || isGuard) && (
            <div className={isTerminalFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-3 sm:p-6 overflow-y-auto flex flex-col space-y-4' : 'space-y-4'}>
              {/* Fullscreen Kiosk Header Bar */}
              {isTerminalFullscreen && (
                <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/30">
                      <ScanLine className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold tracking-tight uppercase">
                        Turnstile Station Kiosk · {activeLane}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Perimeter Speed Gate Access Control · High-Speed Verification
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsAudioMuted((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title={isAudioMuted ? 'Unmute turnstile chimes' : 'Mute turnstile chimes'}
                    >
                      {isAudioMuted ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-red-400" />
                          <span>Muted</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-green-400" />
                          <span>Audio On</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={toggleTerminalFullscreen}
                      className="px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Exit Fullscreen (Esc)</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
                {/* Left Half: Large Student Display Card */}
                <StudentDisplayCard
                  scanResult={lastScanResult}
                  activeLane={activeLane}
                  direction={laneDirection}
                  onReset={() => setLastScanResult(null)}
                  isFullscreen={isTerminalFullscreen}
                />

                {/* Right Half: Lane Dropdown (Lane A & Lane B only), Direction Toggle, Barcode Input with Camera, Last 10 Scans */}
                <ScanTerminalRightColumn
                  activeLane={activeLane}
                  onLaneChange={setActiveLane}
                  direction={laneDirection}
                  onDirectionChange={setLaneDirection}
                  onScan={handleBarcodeScan}
                  logs={logs}
                  students={students}
                  isProcessing={isProcessing}
                  isFullscreen={isTerminalFullscreen}
                  onToggleFullscreen={toggleTerminalFullscreen}
                  isGateOpen={isGateOpen}
                  gateRemainingSeconds={gateRemainingSeconds}
                />
              </div>
            </div>
          )}

          {/* 6. CAFETERIA SCAN VIEW (Dedicated Dining Scan Terminal for SUPER_ADMIN and CAFETERIA) */}
          {currentPage === 'cafeteria_scan' && (isSuperAdmin || isCafeteria) && (
            <CafeteriaScanPage
              mealLogs={mealLogs}
              mealCards={mealCards}
              students={students}
              settings={settings}
              selectedPeriod={mealType}
              onPeriodChange={setMealType}
              onScan={handleBarcodeScan}
              isProcessing={isProcessing}
              scanResult={cafeteriaScanResult}
              onResetScan={() => setCafeteriaScanResult(null)}
            />
          )}

          {/* 7. SETTINGS VIEW (SUPER_ADMIN Only) */}
          {currentPage === 'settings' && isSuperAdmin && (
            <GateSettings
              settings={settings}
              onUpdateSettings={async (newSettings) => {
                await updateSystemSettings(newSettings);
              }}
              gates={gates}
              onAddGate={handleAddGate}
              onUpdateGate={handleUpdateGate}
              onDeleteGate={handleDeleteGate}
              onResetDemoData={handleResetDemoData}
              activeSection={settingsSection}
              onSectionChange={setSettingsSection}
            />
          )}
        </main>
      </div>

      {/* Floating Modal for Inspecting and Printing Student ID Badges */}
      {badgeModalStudent && (
        <StudentCardBadge
          student={badgeModalStudent}
          isModal={true}
          onClose={() => setBadgeModalStudent(null)}
          onSimulateScan={(barcode) => {
            setBadgeModalStudent(null);
            setCurrentPage('terminal');
            setTimeout(() => handleBarcodeScan(barcode), 200);
          }}
        />
      )}
    </div>
  );
}
