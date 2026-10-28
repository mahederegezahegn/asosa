import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  runTransaction, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { 
  db, 
  toStudentDocId, 
  toMealLogDocId,
  getLocalDateString,
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';
import { 
  Student, 
  GateLane, 
  GateScanLog, 
  MealLog, 
  SystemSettings, 
  SystemUser, 
  GateDirection, 
  ScanResultType 
} from '../types/gate';
import { 
  INITIAL_STUDENTS, 
  INITIAL_GATES, 
  INITIAL_SETTINGS, 
  INITIAL_USERS,
  INITIAL_MEAL_LOGS,
  INITIAL_MEAL_CARDS
} from '../data/mockData';
import { MealCard } from '../types/gate';

export interface ScanTransactionResult {
  result: ScanResultType;
  message: string;
  reason: string;
  student?: Student;
  direction: GateDirection;
  barcode: string;
  timestamp: string;
  gateName: string;
  logId: string;
}

/**
 * Seed initial Firestore database collections if they are empty
 */
export async function seedInitialDataIfEmpty() {
  try {
    // 1. Check Settings
    const settingsRef = doc(db, 'settings', 'system');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, INITIAL_SETTINGS);
    } else {
      const data = settingsSnap.data();
      if (!data.mealPeriods) {
        await updateDoc(settingsRef, {
          mealPeriods: INITIAL_SETTINGS.mealPeriods,
        });
      }
    }

    // 2. Check Gates / ScanPoints
    const gatesColl = collection(db, 'scanPoints');
    const gatesSnap = await getDocs(gatesColl);
    if (gatesSnap.empty) {
      for (const gate of INITIAL_GATES) {
        await setDoc(doc(db, 'scanPoints', gate.id), gate);
      }
    } else {
      // Ensure meal scan point is available
      const mealDoc = await getDoc(doc(db, 'scanPoints', 'meal-01'));
      if (!mealDoc.exists()) {
        const mealGate = INITIAL_GATES.find(g => g.id === 'meal-01');
        if (mealGate) {
          await setDoc(doc(db, 'scanPoints', 'meal-01'), mealGate);
        }
      }
    }

    // 3. Check Students (30 sample students)
    const studentsColl = collection(db, 'students');
    const studentsSnap = await getDocs(query(studentsColl, limit(1)));
    if (studentsSnap.empty) {
      for (const student of INITIAL_STUDENTS) {
        await setDoc(doc(db, 'students', toStudentDocId(student.id)), student);
      }
    }

    // 4. Check Users
    const usersColl = collection(db, 'users');
    const usersSnap = await getDocs(query(usersColl, limit(1)));
    if (usersSnap.empty) {
      for (const user of INITIAL_USERS) {
        await setDoc(doc(db, 'users', user.id), user);
      }
    }

    // 5. Check Meal Logs
    const mealLogsColl = collection(db, 'mealLogs');
    const mealLogsSnap = await getDocs(query(mealLogsColl, limit(1)));
    if (mealLogsSnap.empty) {
      for (const mLog of INITIAL_MEAL_LOGS) {
        await setDoc(doc(db, 'mealLogs', mLog.id), mLog);
      }
    }

    // 6. Check Meal Cards (dedicated barcode cards for dining hall)
    const mealCardsColl = collection(db, 'mealCards');
    const mealCardsSnap = await getDocs(query(mealCardsColl, limit(1)));
    if (mealCardsSnap.empty) {
      for (const card of INITIAL_MEAL_CARDS) {
        const cardDocId = encodeURIComponent(card.cardNumber.trim().toUpperCase());
        await setDoc(doc(db, 'mealCards', cardDocId), {
          ...card,
          cardNumber: card.cardNumber.trim().toUpperCase(),
        });
      }
    }
  } catch (err) {
    console.warn('Initial Firestore seed non-critical warning:', err);
  }
}

/**
 * Executes gate scan logic inside a robust Firestore transaction
 * Requirement order:
 * 1) barcode not found -> DENIED "Not registered"
 * 2) status SUSPENDED or EXPIRED -> DENIED with reason
 * 3) curfew enabled, entry scan, outside curfew-allowed hours, student not curfewExempt -> DENIED
 * 4) anti-passback enabled: entry while currentState is IN, or exit while OUT -> WARNING
 * 5) otherwise ALLOWED and update currentState.
 * Log every attempt, including denied and unregistered ones, with raw scanned value, scan point and reason.
 */
export async function executeGateScanTransaction(
  rawBarcode: string,
  gateId: string,
  gateName: string,
  direction: GateDirection,
  operatorId?: string
): Promise<ScanTransactionResult> {
  const cleanCode = rawBarcode.trim().toUpperCase();
  const timestampStr = new Date().toISOString();
  const logDocRef = doc(collection(db, 'scanLogs'));

  const studentDocId = toStudentDocId(cleanCode);
  const studentDocRef = doc(db, 'students', studentDocId);

  try {
    const txResult = await runTransaction(db, async (transaction) => {
      // READ 1: Student Document
      const studentSnap = await transaction.get(studentDocRef);

      // READ 2: System Settings
      const settingsDocRef = doc(db, 'settings', 'system');
      const settingsSnap = await transaction.get(settingsDocRef);
      const currentSettings: SystemSettings = settingsSnap.exists()
        ? (settingsSnap.data() as SystemSettings)
        : INITIAL_SETTINGS;

      // READ 3: Scan Point
      const gateDocRef = doc(db, 'scanPoints', gateId);
      const gateSnap = await transaction.get(gateDocRef);

      let result: ScanResultType = 'ALLOWED';
      let message = 'Access Granted';
      let reason = 'Authorized passage verified';
      let studentData: Student | undefined = undefined;

      // 1) Barcode not found -> DENIED "Not registered"
      if (!studentSnap.exists()) {
        result = 'DENIED_UNREGISTERED';
        message = 'Access Denied';
        reason = 'Not registered';
      } else {
        studentData = studentSnap.data() as Student;

        // 2) status SUSPENDED or EXPIRED -> DENIED with reason
        if (studentData.status === 'SUSPENDED') {
          result = 'DENIED_SUSPENDED';
          message = 'Access Denied';
          reason = 'Account suspended by administration';
        } else if (studentData.status === 'EXPIRED') {
          result = 'DENIED_EXPIRED';
          message = 'Access Denied';
          reason = 'Student credential expired';
        } 
        // 3) curfew enabled, entry scan, outside curfew-allowed hours, student not curfewExempt -> DENIED
        else if (currentSettings.curfewEnabled && direction === 'ENTRY') {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const [startH, startM] = (currentSettings.curfewStart || '22:00').split(':').map(Number);
          const [endH, endM] = (currentSettings.curfewEnd || '06:00').split(':').map(Number);
          const startMinutes = (startH ?? 22) * 60 + (startM ?? 0);
          const endMinutes = (endH ?? 6) * 60 + (endM ?? 0);

          const isCurfewActive = startMinutes > endMinutes
            ? (currentMinutes >= startMinutes || currentMinutes < endMinutes)
            : (currentMinutes >= startMinutes && currentMinutes < endMinutes);

          if (isCurfewActive && !studentData.curfewExempt) {
            result = 'DENIED_CURFEW';
            message = 'Access Denied';
            reason = 'Curfew in effect (outside allowed entry hours)';
          }
        }
        
        // 4) anti-passback enabled: entry while currentState is IN, or exit while OUT -> WARNING
        if (result === 'ALLOWED' && currentSettings.antiPassback) {
          if (direction === 'ENTRY' && studentData.currentState === 'IN') {
            result = 'WARNING';
            message = 'Passback Warning';
            reason = 'Anti-passback warning: Student already logged as IN';
          } else if (direction === 'EXIT' && studentData.currentState === 'OUT') {
            result = 'WARNING';
            message = 'Passback Warning';
            reason = 'Anti-passback warning: Student already logged as OUT';
          }
        }
      }

      // 5) Update scan point today counts
      if (result === 'ALLOWED') {
        if (gateSnap.exists()) {
          const countKey = direction === 'ENTRY' ? 'totalEntriesToday' : 'totalExitsToday';
          const currentCount = gateSnap.data()[countKey] || 0;
          transaction.update(gateDocRef, {
            [countKey]: currentCount + 1,
          });
        }
      }

      // 6) Log EVERY attempt into scanLogs collection (immutable ledger - created, never updated or deleted)
      const logEntry: GateScanLog = {
        id: logDocRef.id,
        timestamp: timestampStr,
        barcode: cleanCode,
        studentId: studentData?.id || cleanCode,
        studentName: studentData?.fullName || 'Not registered',
        department: studentData?.department || 'Unknown',
        gateId,
        gateName,
        direction,
        result,
        message,
        details: reason,
        operatorId: operatorId || 'system',
      };

      transaction.set(logDocRef, logEntry);

      return {
        result,
        message,
        reason,
        student: studentData,
        direction,
        barcode: cleanCode,
        timestamp: timestampStr,
        gateName,
        logId: logDocRef.id,
      };
    });

    // Update student currentState and lastMovement if caller has ADMIN permissions.
    // If caller is GUARD, this safely completes without error as guards only create logs.
    if (txResult?.result === 'ALLOWED' && txResult.student) {
      const nextState = direction === 'ENTRY' ? 'IN' : 'OUT';
      updateDoc(studentDocRef, {
        currentState: nextState,
        lastMovement: {
          timestamp: timestampStr,
          gateId,
          gateName,
          direction,
        },
      }).catch((_err) => {
        // Under security rules, only ADMIN can write students. Scan log was immutably recorded.
      });
    }

    return txResult;
  } catch (err) {
    handleFirestoreError(err, OperationType.TRANSACTION, 'scanLogs/transaction');
  }
}

export interface MealTransactionResult {
  status: 'GRANTED' | 'DENIED' | 'WARNING';
  message: string;
  reason: string;
  student?: Student;
  timestamp: string;
  mealDocId?: string;
  mealType: 'Breakfast' | 'Lunch' | 'Dinner';
  photo?: string;
  cardNumber?: string;
}

/**
 * Cafeteria Meal Scan inside a Firestore transaction:
 * - Looks up card number in mealCards collection (cardNumber, studentId, status) and loads linked student
 * - Rules:
 *   1) unknown card -> DENIED
 *   2) blocked card -> DENIED
 *   3) student not ACTIVE or not mealEligible -> DENIED
 *   4) already served in this period today -> WARNING "Already served"
 *   5) otherwise ALLOWED
 * - Document ID: studentId_date_period in mealLogs so a duplicate cannot be created
 * - Logs every attempt (allowed, warning, denied)
 */
export async function executeMealScanTransaction(
  rawBarcode: string,
  mealType: 'Breakfast' | 'Lunch' | 'Dinner',
  scanPointId: string = 'meal-01',
  scanPointName: string = 'Central Dining Hall - Counter A',
  operatorId?: string
): Promise<MealTransactionResult> {
  const cleanCode = rawBarcode.trim().toUpperCase();
  const timestampStr = new Date().toISOString();
  const dateStr = getLocalDateString(new Date());

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Look up card number in mealCards collection
      const cardDocRef = doc(db, 'mealCards', encodeURIComponent(cleanCode));
      const cardSnap = await transaction.get(cardDocRef);

      // Rule 1: unknown card -> DENIED
      if (!cardSnap.exists()) {
        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: 'UNKNOWN',
          studentName: 'Unknown Card',
          mealType,
          status: 'DENIED',
          reason: `Unknown card: No meal card registered with barcode "${cleanCode}"`,
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'DENIED',
          message: 'Unknown Card',
          reason: `Unknown card: No meal card registered with barcode "${cleanCode}"`,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      const mealCard = cardSnap.data() as MealCard;

      // 2. Load linked student document
      const studentDocId = toStudentDocId(mealCard.studentId);
      const studentDocRef = doc(db, 'students', studentDocId);
      const studentSnap = await transaction.get(studentDocRef);
      const student = studentSnap.exists() ? (studentSnap.data() as Student) : undefined;

      // Rule 2: blocked card -> DENIED
      if (mealCard.status === 'BLOCKED') {
        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: mealCard.studentId,
          studentName: student?.fullName || mealCard.studentName || 'Blocked Cardholder',
          department: student?.department,
          photo: student?.photo,
          mealType,
          status: 'DENIED',
          reason: 'Blocked card: This meal card has been blocked by cafeteria administration',
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'DENIED',
          message: 'Card Blocked',
          reason: 'Blocked card: This meal card has been blocked by cafeteria administration',
          student,
          photo: student?.photo,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      // Check linked student exists
      if (!student) {
        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: mealCard.studentId,
          studentName: mealCard.studentName || 'Unknown Student',
          mealType,
          status: 'DENIED',
          reason: `Student record not found for student ID "${mealCard.studentId}"`,
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'DENIED',
          message: 'Student Not Found',
          reason: `Student record not found for student ID "${mealCard.studentId}"`,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      // Rule 3: student not ACTIVE or not mealEligible -> DENIED
      if (student.status !== 'ACTIVE') {
        const statusReason = student.status === 'SUSPENDED'
          ? 'Account suspended by administration'
          : 'Student credential expired';

        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: student.id,
          studentName: student.fullName,
          department: student.department,
          photo: student.photo,
          mealType,
          status: 'DENIED',
          reason: statusReason,
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'DENIED',
          message: 'Access Denied',
          reason: statusReason,
          student,
          photo: student.photo,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      if (!student.mealEligible) {
        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: student.id,
          studentName: student.fullName,
          department: student.department,
          photo: student.photo,
          mealType,
          status: 'DENIED',
          reason: 'Student is not enrolled in meal plan',
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'DENIED',
          message: 'Meal Ineligible',
          reason: 'Student is not enrolled in meal plan',
          student,
          photo: student.photo,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      // Rule 4: already served in this period today -> WARNING "Already served"
      // Document ID studentId_date_period in mealLogs
      const mealDocId = toMealLogDocId(student.id, dateStr, mealType);
      const mealDocRef = doc(db, 'mealLogs', mealDocId);
      const mealSnap = await transaction.get(mealDocRef);

      if (mealSnap.exists()) {
        const existingData = mealSnap.data();
        const existingTime = existingData?.timestamp 
          ? new Date(existingData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : '';

        const attemptDocRef = doc(collection(db, 'mealLogs'));
        const attemptLog: MealLog = {
          id: attemptDocRef.id,
          timestamp: timestampStr,
          date: dateStr,
          barcode: cleanCode,
          studentId: student.id,
          studentName: student.fullName,
          department: student.department,
          photo: student.photo,
          mealType,
          status: 'WARNING',
          reason: `Already served: ${student.fullName} has already received ${mealType} today${existingTime ? ` at ${existingTime}` : ''}`,
          scanPointId,
          scanPointName,
          operatorId: operatorId || 'cafeteria',
        };
        transaction.set(attemptDocRef, attemptLog);

        return {
          status: 'WARNING',
          message: 'Already served',
          reason: `Already served: ${student.fullName} has already received ${mealType} today${existingTime ? ` at ${existingTime}` : ''}`,
          student,
          photo: student.photo,
          mealDocId,
          mealType,
          timestamp: timestampStr,
          cardNumber: cleanCode,
        };
      }

      // Rule 5: otherwise ALLOWED
      // Use document ID studentId_date_period in mealLogs so a duplicate cannot be created
      const logRecord: MealLog = {
        id: mealDocId,
        timestamp: timestampStr,
        date: dateStr,
        barcode: cleanCode,
        studentId: student.id,
        studentName: student.fullName,
        department: student.department,
        photo: student.photo,
        mealType,
        status: 'GRANTED',
        reason: `Meal approved for ${student.fullName} (${mealType})`,
        scanPointId,
        scanPointName,
        operatorId: operatorId || 'cafeteria',
      };

      transaction.set(mealDocRef, logRecord);

      // Read & update scan point if exists
      const scanPointRef = doc(db, 'scanPoints', scanPointId);
      const scanPointSnap = await transaction.get(scanPointRef);
      if (scanPointSnap.exists()) {
        const curCount = scanPointSnap.data().totalEntriesToday || 0;
        transaction.update(scanPointRef, {
          totalEntriesToday: curCount + 1,
        });
      }

      return {
        status: 'GRANTED',
        message: `${mealType} Approved`,
        reason: `Meal approved for ${student.fullName} (${mealType})`,
        student,
        photo: student.photo,
        mealDocId,
        mealType,
        timestamp: timestampStr,
        cardNumber: cleanCode,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.TRANSACTION, 'mealLogs');
  }
}

// Student CRUD
export async function createStudent(student: Student) {
  const docRef = doc(db, 'students', toStudentDocId(student.id));
  await setDoc(docRef, student);
}

export async function batchCreateStudents(students: Student[]): Promise<number> {
  if (students.length === 0) return 0;
  // Firestore batches have a 500 operation limit; chunk into batches of 200
  const CHUNK_SIZE = 200;
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const stu of chunk) {
      const docRef = doc(db, 'students', toStudentDocId(stu.id));
      batch.set(docRef, stu);
    }
    await batch.commit();
  }
  return students.length;
}

export async function updateStudent(id: string, updates: Partial<Student>) {
  const docRef = doc(db, 'students', toStudentDocId(id));
  await updateDoc(docRef, updates);
}

export async function deleteStudent(id: string) {
  const docRef = doc(db, 'students', toStudentDocId(id));
  await deleteDoc(docRef);
}

// ScanPoint (Gate) CRUD
export async function createScanPoint(point: GateLane) {
  const docRef = doc(db, 'scanPoints', point.id);
  await setDoc(docRef, point);
}

export async function updateScanPoint(id: string, updates: Partial<GateLane>) {
  const docRef = doc(db, 'scanPoints', id);
  await updateDoc(docRef, updates);
}

export async function deleteScanPoint(id: string) {
  const docRef = doc(db, 'scanPoints', id);
  await deleteDoc(docRef);
}

// System Settings Update
export async function updateSystemSettings(updates: Partial<SystemSettings>) {
  const docRef = doc(db, 'settings', 'system');
  await setDoc(docRef, updates, { merge: true });
}

// User Profile CRUD
export async function updateUserProfile(id: string, updates: Partial<SystemUser>) {
  const docRef = doc(db, 'users', id);
  await setDoc(docRef, updates, { merge: true });
}

export async function deleteUserProfile(id: string) {
  const docRef = doc(db, 'users', id);
  await deleteDoc(docRef);
}

// MealCard CRUD & Subscription
export async function getMealCards(): Promise<MealCard[]> {
  const snap = await getDocs(collection(db, 'mealCards'));
  return snap.docs.map((d) => d.data() as MealCard);
}

export function subscribeToMealCards(callback: (cards: MealCard[]) => void) {
  return onSnapshot(collection(db, 'mealCards'), (snap) => {
    callback(snap.docs.map((d) => d.data() as MealCard));
  });
}

export async function createMealCard(card: MealCard) {
  const docRef = doc(db, 'mealCards', encodeURIComponent(card.cardNumber.trim().toUpperCase()));
  await setDoc(docRef, {
    ...card,
    cardNumber: card.cardNumber.trim().toUpperCase(),
  });
}

export async function updateMealCard(cardNumber: string, updates: Partial<MealCard>) {
  const docRef = doc(db, 'mealCards', encodeURIComponent(cardNumber.trim().toUpperCase()));
  await updateDoc(docRef, updates);
}

export async function deleteMealCard(cardNumber: string) {
  const docRef = doc(db, 'mealCards', encodeURIComponent(cardNumber.trim().toUpperCase()));
  await deleteDoc(docRef);
}

export async function replaceMealCard(
  studentId: string,
  oldCardNumber: string | undefined,
  newCardNumber: string,
  studentName?: string
) {
  const batch = writeBatch(db);

  if (oldCardNumber) {
    const oldRef = doc(db, 'mealCards', encodeURIComponent(oldCardNumber.trim().toUpperCase()));
    batch.update(oldRef, { status: 'BLOCKED' });
  }

  const cleanCode = newCardNumber.trim().toUpperCase();
  const newRef = doc(db, 'mealCards', encodeURIComponent(cleanCode));
  const newCard: MealCard = {
    cardNumber: cleanCode,
    studentId,
    status: 'ACTIVE',
    studentName: studentName || 'Student',
    createdAt: new Date().toISOString(),
  };
  batch.set(newRef, newCard);

  const studentRef = doc(db, 'students', toStudentDocId(studentId));
  batch.update(studentRef, { mealEligible: true });

  await batch.commit();
}

export async function batchIssueMealCards(
  items: { studentId: string; studentName: string; cardNumber: string }[]
) {
  if (items.length === 0) return;
  const CHUNK_SIZE = 150;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const cleanCode = item.cardNumber.trim().toUpperCase();
      const cardRef = doc(db, 'mealCards', encodeURIComponent(cleanCode));
      const card: MealCard = {
        cardNumber: cleanCode,
        studentId: item.studentId,
        status: 'ACTIVE',
        studentName: item.studentName,
        createdAt: new Date().toISOString(),
      };
      batch.set(cardRef, card);

      const studentRef = doc(db, 'students', toStudentDocId(item.studentId));
      batch.update(studentRef, { mealEligible: true });
    }

    await batch.commit();
  }
}

