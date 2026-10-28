import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GateScanLog, GateDirection, Student } from '../types/gate';
import { 
  BrowserMultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType, 
  NotFoundException,
  ChecksumException,
  FormatException
} from '@zxing/library';
import { 
  Scan, 
  Camera, 
  CameraOff, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  AlertCircle,
  Cpu,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  Unlock,
  Lock,
  Clock
} from 'lucide-react';

interface ScanTerminalRightColumnProps {
  activeLane: 'Lane A' | 'Lane B';
  onLaneChange: (lane: 'Lane A' | 'Lane B') => void;
  direction: GateDirection;
  onDirectionChange: (dir: GateDirection) => void;
  onScan: (barcode: string) => void;
  logs: GateScanLog[];
  students: Student[];
  isProcessing: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  isGateOpen?: boolean;
  gateRemainingSeconds?: number;
}

export const ScanTerminalRightColumn: React.FC<ScanTerminalRightColumnProps> = ({
  activeLane,
  onLaneChange,
  direction,
  onDirectionChange,
  onScan,
  logs,
  students,
  isProcessing,
  onToggleFullscreen,
  isFullscreen = false,
  isGateOpen = false,
  gateRemainingSeconds = 0,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'BarcodeDetector' | 'ZXing' | null>(null);
  const [lastScannedVisual, setLastScannedVisual] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // Buffer for USB laser barcode scanner that types characters quickly and sends Enter
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Trigger scan action and restore focus immediately
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

    setTimeout(() => setLastScannedVisual(null), 2500);
  }, [onScan]);

  // Keep input always focused for USB scanner
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

  // Camera Barcode Scanning (BarcodeDetector with ZXing Code 128 fallback)
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
      let canUseNativeBarcodeDetector = false;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          // @ts-expect-error Experimental browser API
          const supportedFormats: string[] = await window.BarcodeDetector.getSupportedFormats();
          if (supportedFormats && supportedFormats.includes('code_128')) {
            canUseNativeBarcodeDetector = true;
          }
        } catch {
          canUseNativeBarcodeDetector = false;
        }
      }

      if (canUseNativeBarcodeDetector) {
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
              // Frame dropped, proceed
            }
          }

          animFrameIdRef.current = requestAnimationFrame(scanFrame);
        };

        animFrameIdRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Fallback to ZXing library
        setActiveEngine('ZXing');
        const hints = new Map<DecodeHintType, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        zxingReaderRef.current = reader;

        if (videoRef.current) {
          reader.decodeFromStream(stream, videoRef.current, (result, error) => {
            if (result && !isCooldownRef.current) {
              const rawText = result.getText();
              if (rawText) {
                isCooldownRef.current = true;
                handleTriggerScan(rawText);
                setTimeout(() => {
                  isCooldownRef.current = false;
                }, 2000);
              }
            }
            if (error && !(error instanceof NotFoundException) && !(error instanceof ChecksumException) && !(error instanceof FormatException)) {
              // Ignore standard frame miss
            }
          });
        }
      }
    } catch (err) {
      console.error('Camera startup error:', err);
      setCameraError('Unable to access camera. Please allow camera permissions or use USB scanner.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {}
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setActiveEngine(null);
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm space-y-5">
      {/* 1. Terminal Header with Lane, Direction, Barrier State & Fullscreen Button */}
      <div className="space-y-3 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 tracking-tight uppercase">
                Turnstile Terminal Controls
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-50 text-[#15803D] border border-green-200">
                Live Physical Barrier
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Select turnstile lane, passage vector, and capture credentials.
            </p>
          </div>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer self-start sm:self-auto ${
                isFullscreen
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-2xs'
              }`}
              title={isFullscreen ? 'Exit full screen kiosk mode' : 'Expand terminal to full screen kiosk'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Exit Full Screen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>Full Screen Kiosk</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Live Barrier State Feedback Bar */}
        <div
          className={`p-3 rounded-lg border transition-all duration-300 flex items-center justify-between gap-3 ${
            isGateOpen
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isGateOpen
                  ? 'bg-emerald-600 text-white animate-pulse'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {isGateOpen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span>{isGateOpen ? 'PASSAGE UNLOCKED — BARRIER OPEN' : 'TURNSTILE BARRIER LOCKED'}</span>
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {isGateOpen
                  ? `Solenoid released · Student may pass through ${activeLane}`
                  : `Waiting for valid credentials · Physical arm engaged`}
              </div>
            </div>
          </div>

          {isGateOpen && gateRemainingSeconds > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-emerald-300 text-xs font-mono font-bold text-emerald-700 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{gateRemainingSeconds.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Lane Selector and Inbound/Outbound Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Active Lane Dropdown */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Active Lane
            </label>
            <select
              value={activeLane}
              onChange={(e) => onLaneChange(e.target.value as 'Lane A' | 'Lane B')}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#15803D]"
            >
              <option value="Lane A">Lane A (Speed Gate Turnstile 01)</option>
              <option value="Lane B">Lane B (Speed Gate Turnstile 02)</option>
            </select>
          </div>

          {/* Entry / Exit Toggle */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Turnstile Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onDirectionChange('ENTRY')}
                className={`py-2 px-3 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  direction === 'ENTRY'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Entry</span>
              </button>
              <button
                type="button"
                onClick={() => onDirectionChange('EXIT')}
                className={`py-2 px-3 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  direction === 'EXIT'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barcode Input (Always Focused, USB Scanner Ready) with Camera Scan Button */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Barcode Scanner (USB & Manual)
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

        {/* Live Camera Viewfinder (Shown when camera scan button is toggled) */}
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
                  ALIGN CODE 128 BARCODE ACROSS RED LINE
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
          <Scan className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            disabled={isProcessing}
            placeholder="Scan barcode or type & press Enter..."
            className="w-full pl-9 pr-20 py-2.5 bg-white border-2 border-gray-300 focus:border-[#15803D] rounded-md text-sm font-mono font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isProcessing || !barcodeInput.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            {isProcessing ? 'Checking...' : 'Scan'}
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

        {/* Quick Test Barcodes for instant testing */}
        <div className="pt-2">
          <div className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#15803D]" />
            <span>Quick Test Students:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {students.slice(0, 4).map((stu) => (
              <button
                key={stu.id}
                type="button"
                onClick={() => handleTriggerScan(stu.id)}
                className="px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-300 text-[11px] font-mono text-gray-700 transition-colors cursor-pointer"
                title={`${stu.fullName} (${stu.status})`}
              >
                {stu.id} ({stu.status})
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleTriggerScan('UNREGISTERED-999')}
              className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-mono text-[#DC2626] transition-colors cursor-pointer"
              title="Test Unregistered Barcode"
            >
              Unknown [Denied]
            </button>
          </div>
        </div>
      </div>

      {/* 3. The Last 10 Scans */}
      <div className="pt-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <h4 className="font-bold text-gray-900 uppercase tracking-wider">
            Last 10 Scans
          </h4>
          <span className="text-gray-500 font-medium">
            {logs.length} logged today
          </span>
        </div>

        <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No scans recorded yet today. Scan a barcode to start logging passages.
            </div>
          ) : (
            logs.slice(0, 10).map((log) => {
              const isAllowed = log.result === 'ALLOWED' || log.result === 'GRANTED';
              const isWarning = log.result === 'WARNING';
              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isAllowed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="font-bold text-gray-900 truncate">
                        {log.studentName}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {log.barcode} · {log.direction} · {log.gateName || 'Lane A'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isAllowed
                          ? 'bg-green-50 border-green-200 text-[#15803D]'
                          : isWarning
                          ? 'bg-white border-[#DC2626] text-[#DC2626]'
                          : 'bg-[#DC2626] text-white border-transparent'
                      }`}
                    >
                      {log.result.replace('DENIED_', '')}
                    </span>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
