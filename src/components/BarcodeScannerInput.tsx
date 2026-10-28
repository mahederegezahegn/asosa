import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student } from '../types/gate';
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
  Keyboard, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Zap, 
  RefreshCw,
  Cpu,
  Layers,
  ShieldCheck
} from 'lucide-react';

interface BarcodeScannerInputProps {
  onScan: (barcode: string) => void;
  students: Student[];
  isProcessing: boolean;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  onScan,
  students,
  isProcessing,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'BarcodeDetector' | 'ZXing' | null>(null);
  const [lastScannedVisual, setLastScannedVisual] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isCooldownRef = useRef<boolean>(false);

  // USB Barcode Wedge Buffer (for hardware laser scanners typing in rapid bursts)
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Trigger scan with debouncing and focus recovery
  const handleTriggerScan = useCallback(
    (code: string) => {
      const clean = code.trim().toUpperCase();
      if (!clean) return;

      setLastScannedVisual(clean);
      onScan(clean);
      setManualCode('');

      // Auto re-focus input immediately so the next USB scan lands without interruption
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          setIsInputFocused(true);
        }
      }, 50);

      setTimeout(() => setLastScannedVisual(null), 2500);
    },
    [onScan]
  );

  // =========================================================================
  // REQUIREMENT: Keep the input ALWAYS focused for USB scanners
  // USB laser scanners type keystrokes into the active element and hit Enter
  // =========================================================================
  useEffect(() => {
    // Initial focus on mount
    if (inputRef.current) {
      inputRef.current.focus();
      setIsInputFocused(true);
    }

    // Window click: if user clicks background/blank area, keep focus on input
    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not steal focus if clicking into another input, textarea, select or modal button
      const isOtherInteractive =
        (target.tagName === 'INPUT' && target !== inputRef.current) ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('[role="dialog"]');

      if (!isOtherInteractive && inputRef.current) {
        inputRef.current.focus();
        setIsInputFocused(true);
      }
    };

    // Periodic safety check to ensure input remains focused when idle
    const focusInterval = setInterval(() => {
      const activeEl = document.activeElement;
      const isAnotherInputActive =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.closest('[role="dialog"]'));

      if (!isAnotherInputActive && inputRef.current && activeEl !== inputRef.current) {
        inputRef.current.focus();
        setIsInputFocused(true);
      }
    }, 1500);

    window.addEventListener('click', handleWindowClick);

    return () => {
      window.removeEventListener('click', handleWindowClick);
      clearInterval(focusInterval);
    };
  }, []);

  // Global Hardware Scanner keystroke listener (Wedge mode fallback)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // If typing in another input/textarea outside our terminal, ignore
      if (target && target.tagName === 'INPUT' && target !== inputRef.current) {
        return;
      }
      if (target && target.tagName === 'TEXTAREA') {
        return;
      }

      const now = Date.now();
      // Fast keystrokes (<75ms) indicate a USB barcode laser scanner
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

  // =========================================================================
  // REQUIREMENT: Real Code 128 Camera Barcode Decoding
  // 1) Use BarcodeDetector where available (hardware accelerated)
  // 2) Fallback to ZXing library (BrowserMultiFormatReader) for 100% Code 128 support
  // =========================================================================

  const startCamera = async () => {
    setCameraError(null);
    setActiveEngine(null);

    try {
      // 1. Get Camera Media Stream with optimal resolution for barcode reading
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

      // 2. Check if native BarcodeDetector is available and supports Code 128
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
        // --- PATH A: Native BarcodeDetector (Chrome/Edge/Android) ---
        setActiveEngine('BarcodeDetector');
        // @ts-expect-error Experimental browser API
        const detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'upc_a', 'qr_code'],
        });

        const scanFrameNative = async () => {
          if (
            videoRef.current &&
            videoRef.current.readyState >= 2 &&
            !videoRef.current.paused
          ) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && !isCooldownRef.current) {
                const detectedValue = barcodes[0].rawValue;
                if (detectedValue) {
                  isCooldownRef.current = true;
                  handleTriggerScan(detectedValue);

                  // 1.5s scan debounce cooldown
                  setTimeout(() => {
                    isCooldownRef.current = false;
                  }, 1500);
                }
              }
            } catch {
              // Frame dropped, continue
            }
          }

          animFrameIdRef.current = requestAnimationFrame(scanFrameNative);
        };

        animFrameIdRef.current = requestAnimationFrame(scanFrameNative);
      } else {
        // --- PATH B: ZXing Library (BrowserMultiFormatReader) Fallback ---
        setActiveEngine('ZXing');

        // Configure ZXing hints specifically optimized for Code 128 barcodes
        const hints = new Map<DecodeHintType, unknown>();
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

        // Decode continuously from the active video stream
        if (videoRef.current) {
          reader.decodeFromStream(stream, videoRef.current, (result, err) => {
            if (result && !isCooldownRef.current) {
              const text = result.getText();
              if (text) {
                isCooldownRef.current = true;
                handleTriggerScan(text);

                // 1.5s scan debounce cooldown
                setTimeout(() => {
                  isCooldownRef.current = false;
                }, 1500);
              }
            }

            // Ignore expected NotFoundException while barcode is searching
            if (err && !(err instanceof NotFoundException) && !(err instanceof ChecksumException) && !(err instanceof FormatException)) {
              // Non-critical decoding frame error
            }
          });
        }
      }

      // Re-focus manual input
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      console.error('Camera initialization failed:', err);
      setCameraError('Camera access unavailable or permission denied. USB Scanner & Manual input ready.');
      setIsCameraActive(false);
      setActiveEngine(null);
    }
  };

  const stopCamera = () => {
    // 1. Cancel animation frame
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    // 2. Reset ZXing reader if active
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // Ignore reset error
      }
      zxingReaderRef.current = null;
    }

    // 3. Stop MediaStream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 4. Detach video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setActiveEngine(null);

    // Keep manual input focused
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleTriggerScan(manualCode.trim());
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-[#15803D]" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
              Barcode Reader Terminal
            </h3>
            <span className="text-xs text-gray-500">
              Code 128 Camera Scanner & USB Keyboard Wedge Input
            </span>
          </div>
        </div>

        {/* Camera Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
              isCameraActive
                ? 'bg-red-50 text-[#DC2626] border-red-200 hover:bg-red-100'
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
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
                <span>Start Camera</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Camera Live Viewfinder */}
      {isCameraActive && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-300 aspect-video max-h-60 flex items-center justify-center">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Clean Optical Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-4/5 h-28 border border-dashed border-white/80 rounded-md relative flex items-center justify-center">
                {/* Clean Horizontal Red Laser Line */}
                <div className="w-full h-0.5 bg-[#DC2626]" />

                <span className="absolute bottom-2 text-[10px] text-white bg-black/75 px-2 py-0.5 rounded font-medium">
                  ALIGN CODE 128 BARCODE ACROSS RED LINE
                </span>
              </div>
            </div>

            {/* Engine Status Tag */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded bg-white/90 border border-gray-200 text-[11px] text-gray-700 shadow-sm">
              {activeEngine === 'BarcodeDetector' ? (
                <>
                  <Cpu className="w-3 h-3 text-[#15803D]" />
                  <span>Engine: <strong>BarcodeDetector</strong></span>
                </>
              ) : (
                <>
                  <Layers className="w-3 h-3 text-gray-700" />
                  <span>Engine: <strong>ZXing MultiFormat</strong></span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Manual Input Fallback & USB Wedge Input */}
      <form onSubmit={handleManualSubmit} className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-700 font-semibold flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-gray-500" />
            <span>Manual Input & USB Scanner Buffer</span>
          </span>

          {/* USB Scanner Status Chip */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${
              isInputFocused
                ? 'bg-green-50 border-green-200 text-[#15803D]'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isInputFocused ? 'bg-[#15803D]' : 'bg-gray-400'
              }`}
            />
            {isInputFocused ? 'USB Scanner Ready (Input Focused)' : 'Click to Focus'}
          </span>
        </div>

        <div className="relative flex items-center">
          <Keyboard className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => {
              setTimeout(() => {
                const active = document.activeElement;
                if (!active || active === document.body) {
                  inputRef.current?.focus();
                  setIsInputFocused(true);
                }
              }, 100);
            }}
            placeholder="Scan barcode with USB laser or type student ID (e.g. RU0073/16-0)..."
            className={`w-full pl-10 pr-24 py-2 bg-white border rounded-md text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors ${
              isInputFocused
                ? 'border-[#15803D] ring-1 ring-[#15803D]'
                : 'border-gray-300'
            }`}
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || isProcessing}
            className="absolute right-1.5 px-3 py-1 bg-[#15803D] hover:bg-[#166534] disabled:opacity-40 disabled:hover:bg-[#15803D] text-white text-xs font-medium rounded transition-colors flex items-center gap-1 cursor-pointer"
          >
            {isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Submit</span>
              </>
            )}
          </button>
        </div>

        {/* Live Scan Notification / Keystroke feedback */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
          <span>USB Scanner Mode: Auto-types barcode characters and submits Enter</span>
          {lastScannedVisual && (
            <span className="text-[#15803D] font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Scanned: {lastScannedVisual}
            </span>
          )}
        </div>
      </form>

      {/* Quick 1-Click Test Credentials */}
      <div className="pt-2 border-t border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Quick Test Credentials (Click to simulate scan):
          </span>
          <span className="text-xs text-gray-500">Test Cards</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {students.slice(0, 6).map((stu) => {
            const isSuspended = stu.status === 'SUSPENDED';
            const isExpired = stu.status === 'EXPIRED';
            const isImageUrl = stu.photo && (stu.photo.startsWith('http') || stu.photo.startsWith('data:image'));

            return (
              <button
                key={stu.id}
                type="button"
                onClick={() => handleTriggerScan(stu.id)}
                disabled={isProcessing}
                className="flex items-center justify-between p-2 rounded-md bg-white hover:bg-gray-50 border border-gray-200 text-left transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isImageUrl ? (
                    <img
                      src={stu.photo}
                      alt={stu.fullName}
                      className="w-6 h-6 rounded object-cover border border-gray-300 shrink-0"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-[#15803D]"
                    >
                      {stu.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                  )}

                  <div className="truncate">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {stu.fullName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {stu.id}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {stu.mealEligible ? '· Meal' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 ml-2">
                  {isSuspended ? (
                    <span className="text-[11px] font-semibold text-[#DC2626]">
                      SUSPENDED
                    </span>
                  ) : isExpired ? (
                    <span className="text-[11px] font-semibold text-[#DC2626]">
                      EXPIRED
                    </span>
                  ) : stu.currentState === 'IN' ? (
                    <span className="text-[11px] font-semibold text-[#15803D]">
                      IN
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-500">
                      OUT
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Test Unknown / Unregistered Barcode Button */}
          <button
            type="button"
            onClick={() => handleTriggerScan('RU9999/99-9')}
            disabled={isProcessing}
            className="flex items-center justify-between p-2 rounded-md bg-white hover:bg-red-50 border border-red-200 text-left transition-colors cursor-pointer disabled:opacity-50"
          >
            <div>
              <div className="text-xs font-medium text-[#DC2626]">Unregistered Barcode</div>
              <div className="text-xs text-gray-500">RU9999/99-9</div>
            </div>
            <span className="text-xs font-semibold text-[#DC2626]">
              Test Reject
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
