import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Student, MealLog, MealCard, MealPeriodName, SystemSettings, ScanResultType } from '../types/gate';
import { getLocalDateString } from '../lib/firebase';
import { formatTimeFriendly } from '../utils/mealUtils';
import { 
  BrowserMultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType 
} from '@zxing/library';
import { 
  Utensils, 
  Coffee, 
  ScanLine, 
  Camera, 
  CameraOff, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  AlertCircle,
  RotateCcw,
  Sparkles,
  CreditCard,
  UserX,
  Layers,
  Cpu,
  Maximize2,
  Minimize2
} from 'lucide-react';

export interface CafeteriaScanResult {
  status: 'GRANTED' | 'DENIED' | 'WARNING';
  message: string;
  details?: string;
  student?: Student;
  timestamp: string;
  cardNumber?: string;
  mealType: MealPeriodName;
}

interface CafeteriaScanPageProps {
  mealLogs: MealLog[];
  mealCards: MealCard[];
  students: Student[];
  settings: SystemSettings;
  selectedPeriod: MealPeriodName;
  onPeriodChange: (period: MealPeriodName) => void;
  onScan: (barcode: string) => void;
  isProcessing: boolean;
  scanResult: CafeteriaScanResult | null;
  onResetScan: () => void;
}

export const CafeteriaScanPage: React.FC<CafeteriaScanPageProps> = ({
  mealLogs,
  mealCards,
  students,
  settings,
  selectedPeriod,
  onPeriodChange,
  onScan,
  isProcessing,
  scanResult,
  onResetScan,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'BarcodeDetector' | 'ZXing' | null>(null);
  const [lastScannedVisual, setLastScannedVisual] = useState<string | null>(null);

  // Fullscreen Kiosk State
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // Buffer for fast USB laser barcode scanner
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Trigger scan action and restore input focus immediately
  const handleTriggerScan = useCallback((code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLastScannedVisual(clean);
    onScan(clean);
    setBarcodeInput('');

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);

    setTimeout(() => setLastScannedVisual(null), 2500);
  }, [onScan]);

  // Keep barcode input always focused for USB scanner
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isOtherInteractive =
        (target.tagName === 'INPUT' && target !== inputRef.current) ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[role="dialog"]');

      if (!isOtherInteractive && inputRef.current) {
        inputRef.current.focus();
      }
    };

    const focusInterval = setInterval(() => {
      const activeEl = document.activeElement;
      const isOther =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.closest('[role="dialog"]'));

      if (!isOther && inputRef.current && activeEl !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 1500);

    window.addEventListener('click', handleWindowClick);

    return () => {
      window.removeEventListener('click', handleWindowClick);
      clearInterval(focusInterval);
    };
  }, []);

  // USB Barcode wedge keystroke listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && target !== inputRef.current) return;
      if (target && target.tagName === 'TEXTAREA') return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) {
        keyBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (keyBufferRef.current.length >= 2) {
          e.preventDefault();
          const scannedCode = keyBufferRef.current.trim();
          keyBufferRef.current = '';
          handleTriggerScan(scannedCode);
        }
      } else if (e.key.length === 1) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleTriggerScan]);

  // Camera Barcode Scanning
  const startCamera = async () => {
    setCameraError(null);
    setActiveEngine(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);

      // Check native BarcodeDetector
      let canUseNative = false;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          // @ts-expect-error Experimental browser API
          const supportedFormats: string[] = await window.BarcodeDetector.getSupportedFormats();
          if (supportedFormats && supportedFormats.includes('code_128')) {
            canUseNative = true;
          }
        } catch {
          canUseNative = false;
        }
      }

      if (canUseNative) {
        setActiveEngine('BarcodeDetector');
        // @ts-expect-error Experimental browser API
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'upc_a', 'qr_code'],
        });

        const scanFrame = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrameIdRef.current = requestAnimationFrame(scanFrame);
            return;
          }

          if (!isCooldownRef.current) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                if (detected) {
                  isCooldownRef.current = true;
                  handleTriggerScan(detected);
                  setTimeout(() => {
                    isCooldownRef.current = false;
                  }, 2000);
                }
              }
            } catch {
              // Frame decoding error
            }
          }
          animFrameIdRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameIdRef.current = requestAnimationFrame(scanFrame);
      } else {
        // ZXing Fallback
        setActiveEngine('ZXing');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.UPC_A,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        zxingReaderRef.current = reader;

        const scanZXingLoop = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrameIdRef.current = requestAnimationFrame(scanZXingLoop);
            return;
          }

          if (!isCooldownRef.current) {
            try {
              const result = reader.decode(videoRef.current);
              if (result && result.getText()) {
                isCooldownRef.current = true;
                handleTriggerScan(result.getText());
                setTimeout(() => {
                  isCooldownRef.current = false;
                }, 2000);
              }
            } catch {
              // Not found in this frame
            }
          }
          animFrameIdRef.current = requestAnimationFrame(scanZXingLoop);
        };

        animFrameIdRef.current = requestAnimationFrame(scanZXingLoop);
      }
    } catch (err) {
      console.error('Camera open failed:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or use USB scanner.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActiveEngine(null);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleTriggerScan(barcodeInput);
  };

  // Metrics: Count of meals served in the selected period today
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);

  const mealsServedInPeriodToday = useMemo(() => {
    return mealLogs.filter((m) => {
      const logDate = m.date || (m.timestamp ? m.timestamp.slice(0, 10) : '');
      const isToday = logDate === todayStr;
      const isPeriod = m.mealType === selectedPeriod;
      const isServed = m.status === 'GRANTED';
      return isToday && isPeriod && isServed;
    }).length;
  }, [mealLogs, todayStr, selectedPeriod]);

  // Last 10 Served Students
  const last10Served = useMemo(() => {
    return mealLogs
      .filter((m) => m.status === 'GRANTED')
      .slice(0, 10);
  }, [mealLogs]);

  // Status checks for scan result
  const isAllowed = scanResult?.status === 'GRANTED';
  const isWarning = scanResult?.status === 'WARNING';
  const isDenied = scanResult && !isAllowed && !isWarning;
  const student = scanResult?.student;
  const isPhotoUrl = student?.photo && (student.photo.startsWith('http') || student.photo.startsWith('data:image'));

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-gray-50 flex flex-col p-3 sm:p-6 overflow-y-auto space-y-4' : 'space-y-4'}>
      {/* Kiosk Header Bar with Active Period & Fullscreen button */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D]">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span>Dining Hall Kiosk Terminal</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[#15803D]">
                {selectedPeriod} Service
              </span>
            </div>
            <div className="text-[11px] text-gray-500">
              Central Dining Facility · Real-time Meal Authorization
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-2xs'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Expand to Full Screen Kiosk'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Full Screen Kiosk</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* ============================================================ */}
        {/* LEFT HALF: Large Student Display Card                        */}
        {/* ============================================================ */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm flex flex-col justify-between min-h-[520px] sm:min-h-[580px] space-y-6">
          {!scanResult ? (
            // Ready to scan state
            <div className="flex flex-col items-center justify-center my-auto py-8 sm:py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D] mb-4 shadow-xs">
              <Utensils className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Ready to scan
            </h2>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">
              Present a physical meal card to the optical scanner or enter the card number to verify dining authorization.
            </p>

            <div className="mt-8 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200 text-[#15803D] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#15803D] animate-ping" />
              <span>Serving Station: Central Dining · Active Period: {selectedPeriod}</span>
            </div>
          </div>
        ) : (
          // After scan state
          <>
            {/* 1. Large Result Banner */}
            {isAllowed && (
              <div className="w-full bg-[#15803D] text-white p-5 rounded-lg flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-wider uppercase">
                      ALLOWED
                    </div>
                    <div className="text-xs text-white/95 font-medium mt-0.5">
                      {scanResult.details || scanResult.message || 'Meal verified and granted'}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-1 rounded shrink-0">
                  {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}

            {isDenied && (
              <div className="w-full bg-[#DC2626] text-white p-5 rounded-lg flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <XCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-wider uppercase">
                      DENIED
                    </div>
                    <div className="text-xs text-white/95 font-medium mt-0.5">
                      {scanResult.details || scanResult.message || 'Dining authorization rejected'}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-1 rounded shrink-0">
                  {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}

            {isWarning && (
              <div className="w-full bg-white border-2 border-[#DC2626] text-[#DC2626] p-5 rounded-lg flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-wider uppercase text-[#DC2626]">
                      WARNING
                    </div>
                    <div className="text-xs text-gray-700 font-medium mt-0.5">
                      {scanResult.details || scanResult.message || 'Already served in this period'}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold border border-[#DC2626] px-2.5 py-1 rounded text-[#DC2626] shrink-0">
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
                    className="w-48 h-48 rounded-lg object-cover border border-gray-300 shadow-sm"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-4xl text-gray-700 shadow-sm">
                    {student.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </div>
                )}

                {/* Full Name */}
                <h3 className="text-2xl font-bold text-gray-900 mt-4 tracking-tight">
                  {student.fullName}
                </h3>

                {/* Student ID */}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="px-3 py-1 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-sm text-gray-800">
                    {student.id}
                  </span>
                  {scanResult.cardNumber && (
                    <span className="px-2.5 py-1 bg-green-50 border border-green-200 text-[#15803D] rounded font-mono text-xs font-semibold flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{scanResult.cardNumber}</span>
                    </span>
                  )}
                </div>

                {/* Department */}
                <div className="mt-2 text-sm text-gray-700 font-medium">
                  <span>{student.department}</span>
                  <span className="mx-2 text-gray-400">·</span>
                  <span>Level: {student.level}</span>
                </div>

                {/* Meal Plan & Student Status Badges */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded border ${
                      student.status === 'ACTIVE'
                        ? 'bg-green-50 border-green-200 text-[#15803D]'
                        : 'bg-red-50 border-red-200 text-[#DC2626]'
                    }`}
                  >
                    STATUS: {student.status}
                  </span>

                  <span
                    className={`text-xs font-bold px-3 py-1 rounded border ${
                      student.mealEligible
                        ? 'bg-green-50 border-green-200 text-[#15803D]'
                        : 'bg-red-50 border-red-200 text-[#DC2626]'
                    }`}
                  >
                    MEAL PLAN: {student.mealEligible ? 'ENROLLED' : 'NO PLAN'}
                  </span>
                </div>
              </div>
            ) : (
              // Unregistered / Unknown Card
              <div className="flex flex-col items-center text-center my-auto py-6">
                <div className="w-36 h-36 rounded-lg bg-red-50 border-2 border-dashed border-red-300 flex items-center justify-center text-[#DC2626] mb-3">
                  <UserX className="w-16 h-16" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Unknown Meal Card</h3>
                <div className="mt-1.5 px-3 py-1 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-sm text-gray-800">
                  {scanResult.cardNumber || 'Unknown Barcode'}
                </div>
                <p className="mt-2 text-xs text-gray-500 max-w-xs">
                  This card barcode is not enrolled in the mealCards collection. Attempt has been recorded as denied.
                </p>
              </div>
            )}
          </>
        )}

        {/* Card Footer: Meal Period Context & Clear Card button */}
        <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div>
            Period: <strong>{selectedPeriod}</strong> · Dining Hall Station A
          </div>
          {scanResult && (
            <button
              type="button"
              onClick={onResetScan}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ready for Next Card</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT HALF:                                                  */}
      {/* 1. Meal Period Selector (Breakfast, Lunch, Dinner)           */}
      {/* 2. Barcode Input (Always focused, USB scanner, Camera scan)  */}
      {/* 3. Counter of meals served in selected period today          */}
      {/* 4. Last 10 served students                                   */}
      {/* ============================================================ */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
        {/* 1. Meal Period Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-[#15803D]" />
              <span>Meal Period</span>
            </label>
            <span className="text-gray-500 font-medium">
              Auto-selected by schedule (manually changeable)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['Breakfast', 'Lunch', 'Dinner'] as const).map((period) => {
              const periodTimes = settings.mealPeriods?.[period];
              const isSelected = selectedPeriod === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => onPeriodChange(period)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#15803D] bg-green-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-[#15803D]' : 'text-gray-900'}`}>
                      {period}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                    )}
                  </div>
                  {periodTimes && (
                    <div className="text-[10px] text-gray-500 mt-1">
                      {formatTimeFriendly(periodTimes.start)} – {formatTimeFriendly(periodTimes.end)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Counter of Meals Served in Selected Period Today */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {selectedPeriod} Meals Served Today
            </div>
            <div className="text-3xl font-black text-[#15803D] mt-1">
              {mealsServedInPeriodToday}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Validated dining redemptions in {selectedPeriod} today
            </div>
          </div>
          <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-[#15803D] shadow-xs">
            <Utensils className="w-6 h-6" />
          </div>
        </div>

        {/* 3. Barcode Input (Always Focused, USB Scanner Ready) with Camera Scan Button */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Meal Card Barcode Scanner
            </label>

            {/* Camera Scan Button */}
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                isCameraActive
                  ? 'bg-red-50 text-[#DC2626] border-red-200 hover:bg-red-100'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Stop Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>Camera Scan</span>
                </>
              )}
            </button>
          </div>

          {/* Camera Viewfinder */}
          {isCameraActive && (
            <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-300 aspect-video max-h-56 flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Target Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-4/5 h-24 border border-dashed border-white/80 rounded-md relative flex items-center justify-center">
                  <div className="w-full h-0.5 bg-[#DC2626]" />
                  <span className="absolute bottom-1.5 text-[9px] text-white bg-black/80 px-2 py-0.5 rounded font-medium">
                    ALIGN MEAL CARD BARCODE ACROSS RED LINE
                  </span>
                </div>
              </div>

              {/* Engine Tag */}
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-white/90 border border-gray-200 text-[10px] text-gray-700 shadow-xs">
                {activeEngine === 'BarcodeDetector' ? (
                  <>
                    <Cpu className="w-3 h-3 text-[#15803D]" />
                    <span>Engine: BarcodeDetector</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-3 h-3 text-gray-700" />
                    <span>Engine: ZXing Code 128</span>
                  </>
                )}
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Always-focused barcode text input */}
          <form onSubmit={handleManualSubmit} className="relative">
            <ScanLine className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              disabled={isProcessing}
              placeholder="Scan meal card (e.g. MC-0073) or type & Enter..."
              className="w-full pl-9 pr-20 py-2.5 bg-white border-2 border-gray-300 focus:border-[#15803D] rounded-md text-sm font-mono font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isProcessing || !barcodeInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
            >
              {isProcessing ? 'Verifying...' : 'Scan'}
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#15803D]" />
              <span>USB scanner listener active (always focused)</span>
            </span>
            {lastScannedVisual && (
              <span className="text-[#15803D] font-mono font-semibold">
                Scanned: {lastScannedVisual}
              </span>
            )}
          </div>

          {/* Quick Test Meal Cards for instant one-click testing */}
          <div className="pt-2">
            <div className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#15803D]" />
              <span>Quick Test Meal Cards:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-0073')}
                className="px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-300 text-[11px] font-mono text-gray-700 transition-colors cursor-pointer"
                title="Active enrolled student (Alexandre Mercer)"
              >
                MC-0073 (Active)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-0075')}
                className="px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-300 text-[11px] font-mono text-gray-700 transition-colors cursor-pointer"
                title="Active enrolled student (Beatrice O'Connor)"
              >
                MC-0075 (Active)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-0076')}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-mono text-[#DC2626] transition-colors cursor-pointer"
                title="Suspended Student (Carlos Mendez)"
              >
                MC-0076 (Suspended)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-0080')}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-mono text-[#DC2626] transition-colors cursor-pointer"
                title="Not enrolled in meal plan (Gabriel Hayes)"
              >
                MC-0080 (No Plan)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-BLOCKED-01')}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-mono text-[#DC2626] transition-colors cursor-pointer"
                title="Blocked meal card"
              >
                MC-BLOCKED-01 (Blocked)
              </button>
              <button
                type="button"
                onClick={() => handleTriggerScan('MC-UNKNOWN-99')}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-mono text-[#DC2626] transition-colors cursor-pointer"
                title="Unknown card not in mealCards collection"
              >
                MC-UNKNOWN-99 (Unknown)
              </button>
            </div>
          </div>
        </div>

        {/* 4. The Last 10 Served Students */}
        <div className="pt-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-[#15803D]" />
              <span>Last 10 Served Students</span>
            </h4>
            <span className="text-gray-500 font-medium">
              {last10Served.length} recent redemptions
            </span>
          </div>

          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {last10Served.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                No students served yet today. Scan a meal card to validate and record meals.
              </div>
            ) : (
              last10Served.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-gray-900 truncate">
                        {log.studentName || log.studentId}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        ID: {log.studentId} · Card: {log.barcode} · {log.mealType}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-50 border-green-200 text-[#15803D]">
                      ALLOWED
                    </span>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
