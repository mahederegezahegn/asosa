import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Helper to safely encode/decode student document IDs in Firestore
// Student IDs contain slashes (e.g. RU0073/16-0) which must be encoded
// so Firestore doesn't treat them as subcollection path separators.
export function toStudentDocId(studentId: string): string {
  return encodeURIComponent(studentId.trim());
}

export function fromStudentDocId(docId: string): string {
  return decodeURIComponent(docId);
}

// Formats document ID studentId_date_period for mealLogs
// Automatically encodes student IDs with slashes (e.g. RU0073/16-0 -> RU0073%2F16-0)
// so Firestore doesn't misinterpret the slash as a subcollection path separator.
export function toMealLogDocId(studentId: string, dateStr: string, period: string): string {
  const safeStudentId = encodeURIComponent(studentId.trim());
  return `${safeStudentId}_${dateStr}_${period}`;
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Firestore Error Formatter per Skill Specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  TRANSACTION = 'transaction',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'test_conn'));
    return true;
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('Firestore offline warning:', err.message);
      return false;
    }
    return true; // Connection reached server even if doc missing or permission error
  }
}
