import React from 'react';
import { Student, ScanResultType, GateDirection } from '../types/gate';
import { 
  ScanLine, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserX,
  RotateCcw
} from 'lucide-react';

interface StudentDisplayCardProps {
  scanResult: {
    result: ScanResultType;
    message: string;
    details?: string;
    student?: Student;
    timestamp: string;
    barcode?: string;
    direction?: GateDirection;
  } | null;
  activeLane: 'Lane A' | 'Lane B';
  direction: GateDirection;
  onReset?: () => void;
  isFullscreen?: boolean;
}

export const StudentDisplayCard: React.FC<StudentDisplayCardProps> = ({
  scanResult,
  activeLane,
  direction,
  onReset,
  isFullscreen = false,
}) => {
  // Before a scan: Show "Ready to scan"
  if (!scanResult) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-6 sm:p-10 shadow-sm flex flex-col items-center justify-center text-center transition-all ${
        isFullscreen ? 'min-h-[620px]' : 'min-h-[520px]'
      }`}>
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D] mb-4 shadow-xs">
          <ScanLine className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
          Ready to scan
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-sm">
          Awaiting credential scan. Use a physical USB scanner or camera on the right to verify perimeter access.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-[#15803D] text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#15803D] animate-ping" />
          <span>Active: {activeLane} · {direction === 'ENTRY' ? 'Inbound Entry' : 'Outbound Exit'}</span>
        </div>
      </div>
    );
  }

  // After a scan:
  const isAllowed = scanResult.result === 'ALLOWED' || scanResult.result === 'GRANTED';
  const isWarning = scanResult.result === 'WARNING';
  const isDenied = !isAllowed && !isWarning;

  const student = scanResult.student;
  const isPhotoUrl = student?.photo && (student.photo.startsWith('http') || student.photo.startsWith('data:image'));

  // Calculate current presence based on latest movement
  const currentPresence = isAllowed 
    ? (direction === 'ENTRY' ? 'IN' : 'OUT') 
    : (student?.currentState || 'OUT');

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-6 transition-all ${
      isFullscreen ? 'min-h-[620px]' : 'min-h-[520px]'
    }`}>
      {/* 1. Large Result Banner */}
      {isAllowed && (
        <div className="w-full bg-[#15803D] text-white p-4 sm:p-5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="text-xl sm:text-3xl font-black tracking-wider uppercase">
                ALLOWED
              </div>
              <div className="text-xs sm:text-sm text-white/95 font-medium mt-0.5">
                {scanResult.details || scanResult.message || 'Access granted — verified passage'}
              </div>
            </div>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold bg-white/20 px-2.5 py-1 rounded shrink-0">
            {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {isDenied && (
        <div className="w-full bg-[#DC2626] text-white p-4 sm:p-5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="text-xl sm:text-3xl font-black tracking-wider uppercase">
                DENIED
              </div>
              <div className="text-xs sm:text-sm text-white/95 font-medium mt-0.5">
                {scanResult.details || scanResult.message || 'Access denied by security policy'}
              </div>
            </div>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold bg-white/20 px-2.5 py-1 rounded shrink-0">
            {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {isWarning && (
        <div className="w-full bg-white border-2 border-[#DC2626] text-[#DC2626] p-4 sm:p-5 rounded-lg flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-[#DC2626]" />
            </div>
            <div>
              <div className="text-xl sm:text-3xl font-black tracking-wider uppercase text-[#DC2626]">
                WARNING
              </div>
              <div className="text-xs sm:text-sm text-gray-700 font-medium mt-0.5">
                {scanResult.details || scanResult.message || 'Anti-passback alert'}
              </div>
            </div>
          </div>
          <span className="text-[11px] sm:text-xs font-bold border border-[#DC2626] px-2.5 py-1 rounded text-[#DC2626] shrink-0">
            {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {/* 2. Student Identity Details */}
      {student ? (
        <div className="flex flex-col items-center text-center my-auto py-2">
          {/* Large Photo */}
          {isPhotoUrl ? (
            <img
              src={student.photo}
              alt={student.fullName}
              className={`rounded-lg object-cover border border-gray-300 shadow-sm transition-all ${
                isFullscreen ? 'w-48 h-48 sm:w-60 sm:h-60' : 'w-40 h-40 sm:w-48 sm:h-48'
              }`}
            />
          ) : (
            <div className={`rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-gray-700 shadow-sm transition-all ${
              isFullscreen ? 'w-48 h-48 sm:w-60 sm:h-60 text-5xl' : 'w-40 h-40 sm:w-48 sm:h-48 text-4xl'
            }`}>
              {student.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </div>
          )}

          {/* Full Name */}
          <h3 className="text-2xl font-bold text-gray-900 mt-4 tracking-tight">
            {student.fullName}
          </h3>

          {/* Student ID */}
          <div className="mt-1.5">
            <span className="px-3 py-1 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-sm text-gray-800">
              {student.id}
            </span>
          </div>

          {/* Department and Level */}
          <div className="mt-2 text-sm text-gray-700 font-medium">
            <span>{student.department}</span>
            <span className="mx-2 text-gray-400">·</span>
            <span>Level: {student.level}</span>
          </div>

          {/* Status and Presence Badges */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {/* Status */}
            <span
              className={`text-xs font-bold px-3 py-1 rounded border ${
                student.status === 'ACTIVE'
                  ? 'bg-green-50 border-green-200 text-[#15803D]'
                  : 'bg-red-50 border-red-200 text-[#DC2626]'
              }`}
            >
              STATUS: {student.status}
            </span>

            {/* Current Presence (IN/OUT) */}
            <span
              className={`text-xs font-bold px-3 py-1 rounded border ${
                currentPresence === 'IN'
                  ? 'bg-green-50 border-green-200 text-[#15803D]'
                  : 'bg-gray-100 border-gray-300 text-gray-700'
              }`}
            >
              PRESENCE: {currentPresence === 'IN' ? 'IN (ON CAMPUS)' : 'OUT (OFF CAMPUS)'}
            </span>
          </div>
        </div>
      ) : (
        /* Unregistered Barcode Result */
        <div className="flex flex-col items-center text-center my-auto py-6">
          <div className="w-36 h-36 rounded-lg bg-red-50 border-2 border-dashed border-red-300 flex items-center justify-center text-[#DC2626] mb-3">
            <UserX className="w-16 h-16" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Unregistered Credential</h3>
          <div className="mt-1.5 px-3 py-1 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-sm text-gray-800">
            {scanResult.barcode || 'Unknown'}
          </div>
          <p className="mt-2 text-xs text-gray-500 max-w-xs">
            This barcode is not enrolled in the campus directory. Access has been recorded as denied.
          </p>
        </div>
      )}

      {/* Card Footer: Scan context & Reset button */}
      <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <div>
          Lane: <strong>{activeLane}</strong> · Direction: <strong>{direction === 'ENTRY' ? 'Entry (Inbound)' : 'Exit (Outbound)'}</strong>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Card</span>
          </button>
        )}
      </div>
    </div>
  );
};
