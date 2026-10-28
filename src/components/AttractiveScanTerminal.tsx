import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GateScanLog, GateDirection, Student, ScanResultType } from '../types/gate';
import { 
  BrowserMultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType 
} from '@zxing/library';
import { 
  ScanLine, 
  Camera, 
  CameraOff, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserX,
  RotateCcw,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Unlock,
  Lock,
  Sparkles,
  Check
} from 'lucide-react';

interface AttractiveScanTerminalProps {
  activeLane: 'Lane A' | 'Lane B';
  onLaneChange: (lane: 'Lane A' | 'Lane B') => void;
  direction: GateDirection;
  onDirectionChange: (dir: GateDirection) => void;
  onScan: (barcode: string) => void;
  students: Student[];
  isProcessing: boolean;
  scanResult: {
    result: ScanResultType;
    message: string;
    details?: string;
    student?: Student;
    timestamp: string;
    barcode?: string;
    direction?: GateDirection;
  } | null;
  onResetScan: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isAudioMuted: boolean;
  onToggleAudio: () => void;
  isGateOpen?: boolean;
  gateRemainingSeconds?: number;
}

export const AttractiveScanTerminal: React.FC<AttractiveScanTerminalProps> = ({
  activeLane,
  onLaneChange,
  direction,
  onDirectionChange,
  onScan,
  students,
  isProcessing,
  scanResult,
  onResetScan,
  isFullscreen,
  onToggleFullscreen,
  isAudioMuted,
  onToggleAudio,
  isGateOpen = false,
  gateRemainingSeconds = 0,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedVisual, setLastScannedVisual] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // USB Laser Barcode Scanner buffer listener
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Trigger scan action
  const handleTriggerScan = useCallback((code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLastScannedVisual(clean);
    onScan(clean);
    setBarcodeInput('');

    // Re-focus input immediately so the next USB scan is ready
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);

    setTimeout(() => setLastScannedVisual(null), 3000);
  }, [onScan]);

  // Keep input always focused for physical USB barcode scanner
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
        if (keyBufferRef.current.length >= 3) {
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

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE]);
      const reader = new BrowserMultiFormatReader(hints, 250);
      zxingReaderRef.current = reader;

      const scanLoop = async () => {
        if (!videoRef.current || !streamRef.current) return;

        if (!isCooldownRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const result = await reader.decodeOnce(videoRef.current);
            if (result && result.getText()) {
              const code = result.getText().trim();
              isCooldownRef.current = true;
              handleTriggerScan(code);
              setTimeout(() => {
                isCooldownRef.current = false;
              }, 1800);
            }
          } catch {}
        }

        animFrameIdRef.current = requestAnimationFrame(scanLoop);
      };

      animFrameIdRef.current = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      console.warn('Camera scan error:', err);
      setCameraError('Unable to access camera. Please allow webcam permission or use USB scanner.');
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
      try {
        zxingReaderRef.current.reset();
      } catch {}
      zxingReaderRef.current = null;
    }
    setIsCameraActive(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleTriggerScan(barcodeInput.trim());
    }
  };

  // State derivations for Detail Card
  const student = scanResult?.student;
  const isAllowed = scanResult?.result === 'ALLOWED' || scanResult?.result === 'GRANTED';
  const isWarning = scanResult?.result === 'WARNING';
  const isDenied = Boolean(scanResult && !isAllowed && !isWarning);

  const currentPresence = isAllowed 
    ? (direction === 'ENTRY' ? 'IN' : 'OUT') 
    : (student?.currentState || 'OUT');

  const isPhotoUrl = student?.photo && (student.photo.startsWith('http') || student.photo.startsWith('data:image'));

  return (
    <div className={`space-y-4 ${isFullscreen ? 'max-w-6xl mx-auto w-full' : ''}`}>
      {/* 1. Sleek Top Control Bar: Lane & Direction Selectors + Fullscreen & Audio controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Lane & Direction Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lane Selector */}
          <div className="flex items-center p-1 rounded-md bg-gray-100 border border-gray-200 text-xs font-semibold">
            <span className="text-[10px] text-gray-500 uppercase font-bold px-2">Station:</span>
            <button
              type="button"
              onClick={() => onLaneChange('Lane A')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeLane === 'Lane A'
                  ? 'bg-white text-[#15803D] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lane A (Turnstile 01)
            </button>
            <button
              type="button"
              onClick={() => onLaneChange('Lane B')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeLane === 'Lane B'
                  ? 'bg-white text-[#15803D] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Lane B (Turnstile 02)
            </button>
          </div>

          {/* Direction Selector */}
          <div className="flex items-center p-1 rounded-md bg-gray-100 border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onDirectionChange('ENTRY')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                direction === 'ENTRY'
                  ? 'bg-[#15803D] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Inbound Entry</span>
            </button>
            <button
              type="button"
              onClick={() => onDirectionChange('EXIT')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                direction === 'EXIT'
                  ? 'bg-[#15803D] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Outbound Exit</span>
            </button>
          </div>
        </div>

        {/* Right: Barrier Status Indicator + Audio & Fullscreen Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Barrier feedback badge */}
          {isGateOpen ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-pulse">
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
              <span>GATE OPEN ({gateRemainingSeconds.toFixed(1)}s)</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Barrier Locked</span>
            </div>
          )}

          {/* Audio Chime Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`p-2 rounded-md border text-xs font-semibold transition-colors cursor-pointer ${
              isAudioMuted
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title={isAudioMuted ? 'Turnstile audio chimes muted. Click to unmute' : 'Audio chimes active. Click to mute'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#15803D]" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-amber-500/10 text-amber-600 border-amber-300 hover:bg-amber-500/20'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-2xs'
            }`}
            title={isFullscreen ? 'Exit full screen kiosk mode' : 'Expand to full screen kiosk'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Kiosk</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#15803D]" />
                <span className="hidden sm:inline">Kiosk Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. THE MAIN STAGE: Redesigned Two-Column Layout (Input on Left / Detail Card on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        
        {/* =========================================================================
            SECTION 1: THE INPUT (5 cols on lg)
            Clean, attractive, prominent scanner input console
           ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 text-[#15803D] flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight uppercase">
                    Scan Input
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    High-speed USB scanner or manual entry
                  </p>
                </div>
              </div>

              {/* Camera Scanner Toggle Button */}
              <button
                type="button"
                onClick={isCameraActive ? stopCamera : startCamera}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                  isCameraActive
                    ? 'bg-red-50 text-[#DC2626] border-red-200 hover:bg-red-100'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Toggle camera barcode scanner"
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop Camera</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5 text-[#15803D]" />
                    <span>Use Camera</span>
                  </>
                )}
              </button>
            </div>

            {/* Camera Viewfinder (Only when camera active) */}
            {isCameraActive && (
              <div className="relative rounded-lg overflow-hidden bg-gray-950 border border-gray-300 aspect-video max-h-48 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-4/5 h-20 border-2 border-dashed border-emerald-400 rounded-md relative flex items-center justify-center">
                    <div className="w-full h-0.5 bg-red-500" />
                    <span className="absolute bottom-1 text-[9px] text-white bg-black/80 px-2 py-0.5 rounded font-bold">
                      ALIGN BARCODE IN RED LINE
                    </span>
                  </div>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] text-xs">
                {cameraError}
              </div>
            )}

            {/* Prominent Scanner Input Field */}
            <form onSubmit={handleManualSubmit} className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Barcode / Student ID
              </label>

              <div className="relative">
                <ScanLine className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Scan barcode or type & press Enter..."
                  className="w-full pl-11 pr-24 py-3.5 bg-gray-50 hover:bg-white focus:bg-white border-2 border-gray-300 focus:border-[#15803D] rounded-lg text-sm sm:text-base font-mono font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !barcodeInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-bold rounded-md cursor-pointer transition-colors shadow-xs"
                >
                  {isProcessing ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              {/* Status helper text */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse" />
                  <span className="font-medium text-gray-600">Scanner Ready · Auto-focused</span>
                </span>
                {lastScannedVisual && (
                  <span className="text-[#15803D] font-mono font-bold">
                    Captured: {lastScannedVisual}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Quick-Test Buttons (Unobtrusive & clean for easy manual testing) */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-[11px] font-bold text-gray-600 mb-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#15803D]" />
              <span>Quick Test Credentials:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {students.slice(0, 4).map((stu) => (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => handleTriggerScan(stu.id)}
                  className="px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-mono font-bold text-gray-800 transition-colors cursor-pointer shadow-2xs"
                  title={`${stu.fullName} (${stu.status})`}
                >
                  {stu.id}
                  <span className={`ml-1 text-[10px] font-sans font-semibold ${
                    stu.status === 'ACTIVE' ? 'text-[#15803D]' : 'text-[#DC2626]'
                  }`}>
                    ({stu.status})
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleTriggerScan('UNREGISTERED-999')}
                className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-mono font-bold text-[#DC2626] transition-colors cursor-pointer"
                title="Test Unregistered Barcode"
              >
                Unknown ID [Denied]
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: THE DETAIL CARD (7 cols on lg)
            High-contrast, large, crystal-clear credential verification card
           ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-gray-200 rounded-xl p-5 sm:p-7 shadow-sm transition-all min-h-[460px]">
          
          {/* STATE A: IDLE (No scan yet) */}
          {!scanResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center text-[#15803D] shadow-sm">
                  <ScanLine className="w-12 h-12 sm:w-14 sm:h-14 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[#15803D]/20 animate-ping pointer-events-none" />
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  READY TO SCAN
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">
                  Hold barcode badge up to scanner or swipe student ID card to verify access credentials.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold font-mono">
                <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                <span>Station: {activeLane} · {direction === 'ENTRY' ? 'Inbound Entry' : 'Outbound Exit'}</span>
              </div>
            </div>
          ) : (
            /* STATE B: SCAN RESULT DETAIL CARD (Allowed, Denied, or Warning) */
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Status Header Banner */}
              {isAllowed && (
                <div className="w-full bg-[#15803D] text-white p-4 sm:p-5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black tracking-wider uppercase">
                        ACCESS ALLOWED
                      </div>
                      <div className="text-xs sm:text-sm text-white/95 font-semibold mt-0.5">
                        {scanResult.details || scanResult.message || 'Barrier Solenoid Released — Verified Student Passage'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-md shrink-0">
                    {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}

              {isDenied && (
                <div className="w-full bg-[#DC2626] text-white p-4 sm:p-5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <XCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black tracking-wider uppercase">
                        ACCESS DENIED
                      </div>
                      <div className="text-xs sm:text-sm text-white/95 font-semibold mt-0.5">
                        {scanResult.details || scanResult.message || 'Passage Prohibited by Security Policy'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-md shrink-0">
                    {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}

              {isWarning && (
                <div className="w-full bg-white border-2 border-[#DC2626] text-[#DC2626] p-4 sm:p-5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-[#DC2626]" />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black tracking-wider uppercase text-[#DC2626]">
                        SECURITY WARNING
                      </div>
                      <div className="text-xs sm:text-sm text-gray-800 font-semibold mt-0.5">
                        {scanResult.details || scanResult.message || 'Anti-passback alert detected'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold border border-[#DC2626] px-3 py-1 rounded-md shrink-0">
                    {new Date(scanResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Student Identity Information Card */}
              {student ? (
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 py-2 my-auto">
                  {/* Portrait Avatar */}
                  <div className="relative shrink-0">
                    {isPhotoUrl ? (
                      <img
                        src={student.photo}
                        alt={student.fullName}
                        className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl object-cover border-2 border-gray-300 shadow-sm"
                      />
                    ) : (
                      <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl bg-gray-100 border-2 border-gray-300 flex items-center justify-center font-black text-gray-700 text-4xl shadow-sm">
                        {student.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                    )}
                    <span className={`absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border ${
                      student.status === 'ACTIVE'
                        ? 'bg-[#15803D] text-white border-transparent'
                        : 'bg-[#DC2626] text-white border-transparent'
                    }`}>
                      {student.status}
                    </span>
                  </div>

                  {/* Details Block */}
                  <div className="flex-1 text-center sm:text-left space-y-2.5 min-w-0">
                    <div>
                      <h4 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                        {student.fullName}
                      </h4>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1">
                        <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-xs sm:text-sm text-gray-900">
                          {student.id}
                        </span>
                        <span className="text-xs font-semibold text-gray-600">
                          {student.department}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 space-y-1">
                      <div>Level: <strong className="text-gray-900">{student.level}</strong></div>
                      <div>
                        Passage Movement: <strong className={currentPresence === 'IN' ? 'text-[#15803D]' : 'text-gray-900'}>
                          {currentPresence === 'IN' ? 'Moved IN (Campus Grounds)' : 'Moved OUT (Off-site)'}
                        </strong>
                      </div>
                    </div>

                    {/* Privileges Badges */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                        student.mealEligible
                          ? 'bg-green-50 border-green-200 text-[#15803D]'
                          : 'bg-gray-100 border-gray-200 text-gray-400'
                      }`}>
                        {student.mealEligible ? '🍽️ Meal Plan: Active' : 'No Meal Plan'}
                      </span>

                      <span className={`text-xs font-bold px-2.5 py-1 rounded border ${
                        student.curfewExempt
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-gray-100 border-gray-200 text-gray-600'
                      }`}>
                        {student.curfewExempt ? '🌙 Curfew: 24/7 Night Access' : 'Standard Curfew'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Unregistered Barcode Display */
                <div className="flex flex-col items-center justify-center text-center py-6 my-auto space-y-3">
                  <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-[#DC2626]">
                    <UserX className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-gray-900">
                    Unregistered Credential
                  </h4>
                  <div className="px-3.5 py-1 bg-gray-100 border border-gray-200 rounded font-mono font-bold text-sm text-gray-800">
                    {scanResult.barcode || 'Unknown Barcode'}
                  </div>
                  <p className="text-xs text-gray-500 max-w-sm">
                    This barcode is not recognized in the university database. Security alert logged.
                  </p>
                </div>
              )}

              {/* Card Footer: Clear action and context */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Passage at <strong>{activeLane}</strong> · <strong>{direction === 'ENTRY' ? 'Inbound Entry' : 'Outbound Exit'}</strong>
                </div>

                <button
                  type="button"
                  onClick={onResetScan}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-semibold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Card</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
