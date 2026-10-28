export type StudentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
export type StudentState = 'IN' | 'OUT';

export interface Student {
  id: string; // Student ID like RU0073/16-0, used as primary key & barcode content everywhere
  fullName: string;
  department: string;
  level: string;
  photo: string;
  status: StudentStatus;
  curfewExempt: boolean;
  mealEligible: boolean; // default true
  currentState: StudentState; // IN or OUT
  email?: string;
  phone?: string;
  lastMovement?: {
    timestamp: string;
    gateId: string;
    gateName: string;
    direction: 'ENTRY' | 'EXIT';
  };
}

export type GateDirection = 'ENTRY' | 'EXIT';

export type GateStatus = 'LOCKED' | 'UNLOCKED' | 'MAINTENANCE' | 'EMERGENCY_OPEN';

export type ScanPointType = 'speed_gate' | 'flap_barrier' | 'turnstile' | 'MEAL';

export interface GateLane {
  id: string;
  name: string;
  code: string;
  location: string;
  type: ScanPointType;
  allowedDirection: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL';
  status: GateStatus;
  totalEntriesToday: number;
  totalExitsToday: number;
}

export type ScanResultType = 
  | 'ALLOWED'
  | 'GRANTED'
  | 'WARNING'
  | 'DENIED_UNREGISTERED'
  | 'DENIED_SUSPENDED'
  | 'DENIED_EXPIRED'
  | 'DENIED_CURFEW'
  | 'DENIED_PASSBACK'
  | 'DENIED_UNAUTHORIZED_GATE'
  | 'DENIED_MAINTENANCE';

export interface GateScanLog {
  id: string;
  timestamp: string;
  studentId?: string;
  studentNumber?: string;
  studentName: string;
  barcode: string;
  department?: string;
  gateId: string;
  gateName: string;
  direction: GateDirection;
  result: ScanResultType;
  message: string;
  details?: string;
  operatorId?: string;
}

export type MealPeriodName = 'Breakfast' | 'Lunch' | 'Dinner';

export interface MealPeriodTime {
  start: string; // e.g. "07:00"
  end: string;   // e.g. "10:30"
}

export interface MealCard {
  cardNumber: string; // Barcode on the separate physical meal card, e.g. "MC-0073"
  studentId: string;  // Linked student ID in students collection, e.g. "RU0073/16-0"
  status: 'ACTIVE' | 'BLOCKED';
  createdAt?: string;
  studentName?: string;
}

export interface MealLog {
  id: string; // studentId_date_period
  timestamp: string;
  date?: string; // YYYY-MM-DD
  barcode: string;
  studentId?: string;
  studentName?: string;
  department?: string;
  photo?: string;
  mealType: MealPeriodName;
  status: 'GRANTED' | 'DENIED' | 'WARNING';
  reason: string;
  scanPointId?: string;
  scanPointName?: string;
  operatorId?: string;
}

export interface SystemSettings {
  antiPassback: boolean;
  curfewEnabled: boolean;
  curfewStart: string; // e.g. "22:00"
  curfewEnd: string;   // e.g. "06:00"
  gateRelockSeconds: number;
  soundEnabled: boolean;
  emergencyEgressMode: boolean;
  selectedGateId: string;
  mealPeriods?: {
    Breakfast: MealPeriodTime;
    Lunch: MealPeriodTime;
    Dinner: MealPeriodTime;
  };
}

export type UserRole = 'SUPER_ADMIN' | 'GUARD' | 'CAFETERIA';

export interface SystemUser {
  id: string;
  name: string;
  badgeId: string;
  email: string;
  role: UserRole;
  assignedGateId: string;
  status: 'active' | 'offline' | 'deactivated';
  lastActive: string;
}

