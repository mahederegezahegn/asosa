import React from 'react';
import { GateLane, GateDirection, ScanResultType, Student } from '../types/gate';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Unlock, 
  ArrowRight, 
  ArrowLeft,
  Clock,
  Building,
  GraduationCap,
  AlertTriangle,
  Utensils
} from 'lucide-react';

interface GateTurnstileViewProps {
  gate: GateLane;
  direction: GateDirection;
  isOpen: boolean;
  isProcessing: boolean;
  lastResult: {
    result: ScanResultType;
    message: string;
    details?: string;
    student?: Student;
    timestamp: string;
  } | null;
  remainingSeconds: number;
  onManualUnlock: () => void;
  onEmergencyOverride: () => void;
  isEmergencyMode: boolean;
}

export const GateTurnstileView: React.FC<GateTurnstileViewProps> = ({
  gate,
  direction,
  isOpen,
  isProcessing,
  lastResult,
  remainingSeconds,
  onManualUnlock,
  onEmergencyOverride,
  isEmergencyMode,
}) => {
  const isGranted = lastResult?.result === 'GRANTED' || lastResult?.result === 'ALLOWED';
  const isWarning = lastResult?.result === 'WARNING';
  const isDenied = lastResult && !isGranted && !isWarning;

  // Clean barrier arm representation without neon/gradients
  const renderBarrierVisual = () => {
    if (gate.type === 'MEAL') {
      return (
        <div className="w-full max-w-lg bg-gray-50 border border-gray-200 rounded-lg p-5 flex flex-col items-center justify-between min-h-[140px]">
          <div className="w-full flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-gray-700" />
              <span className="text-sm font-bold text-gray-900">{gate.name}</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800 font-medium">
              {gate.code} · Dining Lane
            </span>
          </div>

          <div className="my-4 text-center">
            {isGranted ? (
              <div className="flex items-center justify-center gap-2 text-[#15803D] font-bold text-base">
                <CheckCircle2 className="w-5 h-5" />
                <span>MEAL SERVED</span>
              </div>
            ) : isWarning ? (
              <div className="flex items-center justify-center gap-2 text-[#DC2626] font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>ALREADY SERVED (PERIOD LIMIT)</span>
              </div>
            ) : isDenied ? (
              <div className="flex items-center justify-center gap-2 text-[#DC2626] font-bold text-base">
                <XCircle className="w-5 h-5" />
                <span>MEAL ACCESS DENIED</span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                Ready for student barcode scan
              </div>
            )}
          </div>

          <div className="w-full text-center text-xs text-gray-500 pt-2 border-t border-gray-200">
            Limit: 1 Meal Per Scheduled Dining Window
          </div>
        </div>
      );
    }

    // Physical Speed Gate / Turnstile Barrier Arm Diagram
    return (
      <div className="w-full max-w-lg bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3 border-b border-gray-200 pb-2">
          <span className="font-semibold text-gray-700">{gate.name} ({gate.code})</span>
          <span>{gate.type.replace('_', ' ').toUpperCase()} · {direction}</span>
        </div>

        {/* Turnstile Visual Stanchions and Barrier */}
        <div className="flex items-center justify-between gap-4 py-6 px-8">
          {/* Left Pedestal */}
          <div className="w-16 h-28 bg-white border-2 border-gray-300 rounded-md shadow-sm flex flex-col items-center justify-between p-2">
            <div className={`w-3 h-3 rounded-full ${
              isEmergencyMode 
                ? 'bg-[#DC2626]' 
                : isOpen 
                ? 'bg-[#15803D]' 
                : isDenied 
                ? 'bg-[#DC2626]' 
                : 'bg-gray-400'
            }`} />
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Gate A
            </div>
          </div>

          {/* Center Barrier Passage */}
          <div className="flex-1 flex flex-col items-center justify-center relative h-28 border-x border-dashed border-gray-300 px-4">
            {isEmergencyMode ? (
              <div className="text-center space-y-1">
                <div className="text-xs font-bold text-[#DC2626] uppercase">
                  Emergency Open
                </div>
                <div className="text-[11px] text-gray-600">
                  Free Egress Active
                </div>
              </div>
            ) : isOpen ? (
              <div className="text-center space-y-1">
                <div className="h-1.5 w-full bg-[#15803D] rounded-full" />
                <div className="text-xs font-bold text-[#15803D] flex items-center justify-center gap-1">
                  <Unlock className="w-4 h-4" />
                  <span>Passage Open</span>
                </div>
                {remainingSeconds > 0 && (
                  <div className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Closing in {remainingSeconds.toFixed(1)}s</span>
                  </div>
                )}
              </div>
            ) : isDenied ? (
              <div className="text-center space-y-1">
                <div className="h-1.5 w-full bg-[#DC2626] rounded-full" />
                <div className="text-xs font-bold text-[#DC2626] flex items-center justify-center gap-1">
                  <Lock className="w-4 h-4" />
                  <span>Barrier Locked</span>
                </div>
                <div className="text-[11px] text-[#DC2626]">Access Denied</div>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="h-1.5 w-full bg-gray-400 rounded-full" />
                <div className="text-xs font-medium text-gray-600 flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Barrier Armed</span>
                </div>
                <div className="text-[11px] text-gray-400">Standby</div>
              </div>
            )}
          </div>

          {/* Right Pedestal */}
          <div className="w-16 h-28 bg-white border-2 border-gray-300 rounded-md shadow-sm flex flex-col items-center justify-between p-2">
            <div className={`w-3 h-3 rounded-full ${
              isEmergencyMode 
                ? 'bg-[#DC2626]' 
                : isOpen 
                ? 'bg-[#15803D]' 
                : isDenied 
                ? 'bg-[#DC2626]' 
                : 'bg-gray-400'
            }`} />
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Gate B
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-5">
      {/* Gate Top Bar & Telemetry */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-gray-200 gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-md flex items-center justify-center border ${
              isEmergencyMode
                ? 'bg-red-50 border-red-200 text-[#DC2626]'
                : isOpen
                ? 'bg-green-50 border-green-200 text-[#15803D]'
                : isDenied
                ? 'bg-red-50 border-red-200 text-[#DC2626]'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            {isOpen ? (
              <Unlock className="w-5 h-5" />
            ) : isEmergencyMode ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">{gate.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 font-medium">
                {gate.code}
              </span>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span>{gate.location}</span>
              <span>·</span>
              <span className="uppercase">{gate.type.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Direction Indicator & Today's Volume Counts */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-800">
            {direction === 'ENTRY' ? (
              <ArrowRight className="w-4 h-4 text-[#15803D]" />
            ) : (
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            )}
            <span>LANE {direction}</span>
          </div>

          <div className="text-right text-xs text-gray-600 hidden sm:block">
            <div>Inbound: <strong className="text-gray-900">{gate.totalEntriesToday}</strong></div>
            <div>Outbound: <strong className="text-gray-900">{gate.totalExitsToday}</strong></div>
          </div>
        </div>
      </div>

      {/* Main Physical Turnstile Visual Center */}
      <div className="py-2 flex flex-col items-center justify-center space-y-4">
        {/* Status Billboard */}
        <div className="w-full max-w-lg">
          {isEmergencyMode ? (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-center">
              <div className="text-xs font-bold text-[#DC2626] uppercase flex items-center justify-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Emergency Egress Mode Active — Gates Open</span>
              </div>
            </div>
          ) : isOpen ? (
            <div className="p-3.5 rounded-md bg-green-50 border border-green-200 text-center">
              <div className="text-sm font-bold text-[#15803D] flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{lastResult?.message || 'Access Granted — Barrier Unlocked'}</span>
              </div>
              {lastResult?.details && (
                <div className="text-xs text-[#15803D] mt-1 font-medium">
                  {lastResult.details}
                </div>
              )}
              {remainingSeconds > 0 && (
                <div className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Closing in {remainingSeconds.toFixed(1)}s</span>
                </div>
              )}
            </div>
          ) : isWarning ? (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-center">
              <div className="text-sm font-bold text-[#DC2626] flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Warning: {lastResult?.message || 'Warning'}</span>
              </div>
              {lastResult?.details && (
                <div className="text-xs text-[#DC2626] mt-1 font-medium">
                  {lastResult.details}
                </div>
              )}
            </div>
          ) : isDenied ? (
            <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-center">
              <div className="text-sm font-bold text-[#DC2626] flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>{lastResult?.message || 'Access Denied'}</span>
              </div>
              {lastResult?.details && (
                <div className="text-xs text-[#DC2626] mt-1 font-medium">
                  {lastResult.details}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-center text-xs text-gray-500">
              {isProcessing ? 'Verifying student barcode...' : 'Scanner ready · Present student barcode to camera or USB scanner'}
            </div>
          )}
        </div>

        {/* The Barrier Arm Diagram */}
        {renderBarrierVisual()}
      </div>

      {/* Verified Student Details Card */}
      {lastResult?.student && (
        <div
          className={`p-4 rounded-md border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isGranted
              ? 'bg-green-50/50 border-green-200 text-gray-900'
              : isWarning
              ? 'bg-red-50/50 border-red-200 text-gray-900'
              : 'bg-red-50/50 border-red-200 text-gray-900'
          }`}
        >
          <div className="flex items-center gap-3.5">
            {/* Student Photo */}
            {lastResult.student.photo && (lastResult.student.photo.startsWith('http') || lastResult.student.photo.startsWith('data:')) ? (
              <img
                src={lastResult.student.photo}
                alt={lastResult.student.fullName}
                className="w-14 h-14 rounded-md object-cover border border-gray-300 shrink-0"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-md flex items-center justify-center text-base font-bold text-white shrink-0 bg-[#15803D]"
              >
                {lastResult.student.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
            )}

            {/* Student Name & Core Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-base">
                  {lastResult.student.fullName}
                </span>
                <span className="text-xs text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-300 font-semibold">
                  {lastResult.student.id}
                </span>
              </div>

              <div className="text-xs text-gray-600 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-gray-500" />
                  {lastResult.student.department}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
                  {lastResult.student.level}
                </span>
                <span>·</span>
                {lastResult.student.mealEligible ? (
                  <span className="text-xs text-[#15803D] font-medium flex items-center gap-1">
                    <Utensils className="w-3 h-3" />
                    Meal Eligible
                  </span>
                ) : (
                  <span className="text-xs text-[#DC2626] font-medium flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    No Meal Plan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Verdict & Timestamp */}
          <div className="sm:text-right shrink-0">
            <div className="flex sm:justify-end">
              {isGranted ? (
                <span className="px-2.5 py-1 rounded bg-[#15803D] text-white text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  APPROVED
                </span>
              ) : isWarning ? (
                <span className="px-2.5 py-1 rounded bg-[#DC2626] text-white text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  ALREADY SERVED
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-[#DC2626] text-white text-xs font-semibold flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  DENIED
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(lastResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Operator Controls Footer */}
      <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onManualUnlock}
            disabled={isOpen || isEmergencyMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-300 font-medium transition-colors cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Manual Unlock (5s)</span>
          </button>
          
          <button
            type="button"
            onClick={onEmergencyOverride}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-medium transition-colors cursor-pointer ${
              isEmergencyMode
                ? 'bg-[#DC2626] text-white border-[#DC2626]'
                : 'bg-white hover:bg-red-50 text-[#DC2626] border-red-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isEmergencyMode ? 'Disengage Emergency' : 'Emergency Egress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
