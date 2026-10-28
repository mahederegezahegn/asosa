import { Student, StudentStatus, StudentState } from '../types/gate';

export interface ParsedValidStudent {
  id: string;
  fullName: string;
  department: string;
  level: string;
  status: StudentStatus;
  currentState: StudentState;
  mealEligible: boolean;
  curfewExempt: boolean;
  photo: string;
  email: string;
  phone: string;
  rowNumber: number;
}

export interface ParsedInvalidRow {
  rowNumber: number;
  rawData: string;
  parsedFields: {
    student_id?: string;
    full_name?: string;
    department?: string;
    level?: string;
    [key: string]: string | undefined;
  };
  reason: string;
}

export interface CSVParseResult {
  totalRows: number;
  validRows: ParsedValidStudent[];
  invalidRows: ParsedInvalidRow[];
  headerError?: string;
  detectedColumns: {
    student_id: boolean;
    full_name: boolean;
    department: boolean;
    level: boolean;
  };
}

/**
 * Robust CSV line splitter that handles quoted commas
 */
function splitCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

const AVATAR_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED', 
  '#0891B2', '#DB2777', '#0D9488', '#4F46E5', '#EA580C'
];

/**
 * Parses and validates CSV input for students with columns:
 * student_id, full_name, department, level
 */
export function parseStudentsCSV(
  csvText: string,
  existingStudentIds: Set<string> = new Set()
): CSVParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      headerError: 'The CSV file is empty.',
      detectedColumns: { student_id: false, full_name: false, department: false, level: false },
    };
  }

  // Parse Header row
  const headerRow = splitCSVRow(lines[0]);
  const headerMap: { [standardKey: string]: number } = {};

  headerRow.forEach((col, idx) => {
    const clean = col.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim();
    if (clean === 'student_id' || clean === 'studentid' || clean === 'student_number' || clean === 'id' || clean === 'id_number') {
      headerMap['student_id'] = idx;
    } else if (clean === 'full_name' || clean === 'fullname' || clean === 'name' || clean === 'student_name') {
      headerMap['full_name'] = idx;
    } else if (clean === 'department' || clean === 'dept' || clean === 'faculty' || clean === 'major') {
      headerMap['department'] = idx;
    } else if (clean === 'level' || clean === 'year' || clean === 'class' || clean === 'grade' || clean === 'academic_level') {
      headerMap['level'] = idx;
    }
  });

  const detectedColumns = {
    student_id: headerMap['student_id'] !== undefined,
    full_name: headerMap['full_name'] !== undefined,
    department: headerMap['department'] !== undefined,
    level: headerMap['level'] !== undefined,
  };

  const missingCols: string[] = [];
  if (!detectedColumns.student_id) missingCols.push('student_id');
  if (!detectedColumns.full_name) missingCols.push('full_name');
  if (!detectedColumns.department) missingCols.push('department');
  if (!detectedColumns.level) missingCols.push('level');

  if (missingCols.length > 0) {
    return {
      totalRows: lines.length - 1,
      validRows: [],
      invalidRows: [],
      headerError: `Missing required CSV column headers: ${missingCols.join(', ')}. Expected columns: student_id, full_name, department, level.`,
      detectedColumns,
    };
  }

  const validRows: ParsedValidStudent[] = [];
  const invalidRows: ParsedInvalidRow[] = [];
  const seenIdsInFile = new Map<string, number>(); // ID -> row number

  for (let r = 1; r < lines.length; r++) {
    const rawLine = lines[r];
    const rowNumber = r + 1; // 1-based index including header
    const values = splitCSVRow(rawLine);

    const rawId = values[headerMap['student_id']] ?? '';
    const rawName = values[headerMap['full_name']] ?? '';
    const rawDept = values[headerMap['department']] ?? '';
    const rawLevel = values[headerMap['level']] ?? '';

    const cleanId = rawId.replace(/^["']|["']$/g, '').trim().toUpperCase();
    const cleanName = rawName.replace(/^["']|["']$/g, '').trim();
    const cleanDept = rawDept.replace(/^["']|["']$/g, '').trim();
    const cleanLevel = rawLevel.replace(/^["']|["']$/g, '').trim();

    const parsedFields = {
      student_id: cleanId,
      full_name: cleanName,
      department: cleanDept,
      level: cleanLevel,
    };

    // Validation checks
    const reasons: string[] = [];

    if (!cleanId) {
      reasons.push("Missing required column 'student_id'");
    } else if (cleanId.length < 3) {
      reasons.push("Invalid 'student_id': too short (must be at least 3 characters)");
    } else if (seenIdsInFile.has(cleanId)) {
      const prevRow = seenIdsInFile.get(cleanId);
      reasons.push(`Duplicate 'student_id' "${cleanId}" in CSV (first seen at row ${prevRow})`);
    } else if (existingStudentIds.has(cleanId)) {
      reasons.push(`Student ID "${cleanId}" already exists in student roster`);
    }

    if (!cleanName) {
      reasons.push("Missing required column 'full_name'");
    }

    if (!cleanDept) {
      reasons.push("Missing required column 'department'");
    }

    if (!cleanLevel) {
      reasons.push("Missing required column 'level'");
    }

    if (reasons.length > 0) {
      invalidRows.push({
        rowNumber,
        rawData: rawLine,
        parsedFields,
        reason: reasons.join('; '),
      });
    } else {
      seenIdsInFile.set(cleanId, rowNumber);
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const safeEmailName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.');

      validRows.push({
        rowNumber,
        id: cleanId,
        fullName: cleanName,
        department: cleanDept,
        level: cleanLevel,
        status: 'ACTIVE',
        currentState: 'OUT',
        mealEligible: true,
        curfewExempt: false,
        photo: color,
        email: `${safeEmailName}@campus.edu`,
        phone: '+1 (555) 000-0000',
      });
    }
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    invalidRows,
    detectedColumns,
  };
}

/**
 * Returns a ready-to-download sample CSV string with both valid and intentional invalid test rows
 */
export function getSampleStudentCSVTemplate(): string {
  return `student_id,full_name,department,level
CS2026/01-1,Devon Vance,Computer Science,Year 1
BIO2026/04-2,Mei-Ling Zhou,Biomedical Engineering,Year 2
ARCH2026/08-3,Tariq Al-Mansoor,Architecture,Year 3
ROB2026/12-4,Ksenia Petrov,Robotics,Year 4
,Invalid No-ID Student,Economics,Year 1
LAW2026/09-1,,Law,Year 2
CS2026/01-1,Duplicate Devon Vance,Computer Science,Year 1
`;
}
