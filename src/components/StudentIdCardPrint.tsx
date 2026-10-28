import React, { useRef } from 'react';
import { Student } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { 
  Printer, 
  X, 
  ShieldCheck, 
  Utensils, 
  Moon, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

interface StudentIdCardPrintProps {
  student: Student;
  onClose: () => void;
}

export const StudentIdCardPrint: React.FC<StudentIdCardPrintProps> = ({
  student,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    document.body.classList.add('printing-id-card');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-id-card');
    }, 1200);
  };

  const isImageUrl = 
    student.photo && 
    (student.photo.startsWith('http') || student.photo.startsWith('data:image'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl max-w-xl w-full flex flex-col gap-4 sm:gap-5 max-h-[94vh] overflow-y-auto print:p-0 print:border-none print:shadow-none print:bg-transparent text-gray-900">
        {/* Header Bar - Hidden in print */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Student ID Card (ISO/IEC 7810 ID-1 Standard)</h2>
              <p className="text-[11px] text-gray-500">
                Exact Card Size: 85.6 × 54.0 mm · Code 128 Barcode with Quiet Zone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Spec Callout - Hidden in print */}
        <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-[11px] text-gray-700 flex items-center justify-between print:hidden">
          <span>
            Standard PVC card dimensions (85.6 mm × 54 mm). Includes optical quiet zone around the Code 128 barcode.
          </span>
          <span className="text-[#15803D] font-bold ml-2 shrink-0">85.6 × 54 mm</span>
        </div>

        {/* Card Container Preview & Print Target */}
        <div className="flex justify-center items-center py-2 overflow-x-auto print:p-0">
          {/* 
            PHYSICAL ID CARD:
            Width: 85.6mm (~323.5px at 96 DPI screen scale, exact 85.6mm on print)
            Height: 54mm (~204px at 96 DPI screen scale, exact 54mm on print)
          */}
          <div
            id="printable-id-card"
            ref={cardRef}
            className="student-id-card-element print-id-card relative select-none rounded-[3.18mm] overflow-hidden bg-white text-gray-900 border border-gray-300 shadow-md print:shadow-none print:border print:border-gray-400"
            style={{
              width: '85.6mm',
              height: '54.0mm',
              minWidth: '85.6mm',
              minHeight: '54.0mm',
              maxWidth: '85.6mm',
              maxHeight: '54.0mm',
              boxSizing: 'border-box',
              padding: '2.5mm 3.2mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              backgroundColor: '#FFFFFF',
              color: '#111827',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            {/* Top Institutional Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-[1.2mm]">
              <div className="flex items-center gap-[1.8mm]">
                <div 
                  className="w-[5.2mm] h-[5.2mm] rounded-[1mm] bg-[#15803D] flex items-center justify-center shrink-0 text-white"
                >
                  <ShieldCheck className="w-[3.5mm] h-[3.5mm]" />
                </div>
                <div>
                  <div className="text-[2.6mm] font-black tracking-wider uppercase leading-none text-gray-900">
                    METROPOLITAN INSTITUTE
                  </div>
                  <div className="text-[1.8mm] font-semibold text-gray-500 tracking-tight leading-none mt-[0.6mm]">
                    CAMPUS ACCESS & IDENTITY BADGE
                  </div>
                </div>
              </div>

              {/* Status Chip */}
              <div className="flex items-center gap-[1mm] bg-gray-50 border border-gray-200 rounded-[1mm] px-[1.6mm] py-[0.6mm]">
                <span 
                  className={`w-[1.6mm] h-[1.6mm] rounded-full ${
                    student.status === 'ACTIVE' 
                      ? 'bg-[#15803D]' 
                      : 'bg-[#DC2626]'
                  }`} 
                />
                <span className="text-[1.8mm] font-bold leading-none text-gray-700">
                  {student.status}
                </span>
              </div>
            </div>

            {/* Middle Section: Photo + Student Details */}
            <div className="flex items-center gap-[3mm] my-[1mm]">
              {/* Photo Frame (Approx 20mm x 23mm) */}
              <div 
                className="w-[20mm] h-[23mm] shrink-0 rounded-[1.8mm] border border-gray-300 overflow-hidden shadow-xs flex items-center justify-center bg-gray-50 relative"
              >
                {isImageUrl ? (
                  <img
                    src={student.photo}
                    alt={student.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center font-bold text-white text-[5mm] bg-[#15803D]"
                  >
                    <span>
                      {student.fullName
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span className="text-[1.6mm] tracking-tight opacity-90 mt-[1mm]">
                      STUDENT
                    </span>
                  </div>
                )}
              </div>

              {/* Identity Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {/* Full Name */}
                <h3 className="text-[3.6mm] font-black tracking-tight text-gray-900 leading-tight truncate">
                  {student.fullName}
                </h3>

                {/* Department */}
                <div className="text-[2.4mm] font-bold text-[#15803D] leading-tight truncate mt-[0.6mm]">
                  {student.department}
                </div>

                {/* Level & ID Meta */}
                <div className="text-[2.0mm] text-gray-600 font-medium leading-none mt-[1.2mm] flex items-center gap-[1.5mm]">
                  <span>{student.level}</span>
                  <span>·</span>
                  <span className="font-bold text-gray-900">
                    ID: {student.id}
                  </span>
                </div>

                {/* Privileges Badges */}
                <div className="flex items-center gap-[1.5mm] mt-[1.6mm]">
                  {student.mealEligible && (
                    <span className="flex items-center gap-[0.8mm] text-[1.8mm] font-bold text-[#15803D] bg-green-50 border border-green-200 px-[1.2mm] py-[0.4mm] rounded-[0.8mm]">
                      <Utensils className="w-[2mm] h-[2mm]" />
                      MEAL
                    </span>
                  )}
                  {student.curfewExempt && (
                    <span className="flex items-center gap-[0.8mm] text-[1.8mm] font-bold text-gray-700 bg-gray-100 border border-gray-200 px-[1.2mm] py-[0.4mm] rounded-[0.8mm]">
                      <Moon className="w-[2mm] h-[2mm] text-[#15803D]" />
                      24/7 CURFEW
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 
              Bottom Barcode Section: 
              Code 128 barcode of the student ID with a clear quiet zone around it.
              The quiet zone strictly ensures at least 10x module width (>5mm) clean white margin.
            */}
            <div 
              className="barcode-quiet-zone-wrapper bg-white border border-gray-200 rounded-[1.2mm] flex flex-col items-center justify-center"
              style={{
                backgroundColor: '#FFFFFF',
                padding: '1mm 4mm',
                margin: '0 auto',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div className="w-full flex justify-center">
                <BarcodeRenderer
                  value={student.id}
                  height={22}
                  moduleWidth={1.2}
                  showText={false}
                  lightBackground={false}
                  className="w-full max-w-[70mm]"
                />
              </div>
              <div 
                className="text-[2.2mm] font-bold tracking-[1.5px] text-gray-900 leading-none mt-[0.6mm]"
              >
                *{student.id}*
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden in print */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 print:hidden">
          <div className="text-xs text-gray-500">
            Print scale: 100% (Do not fit to page)
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print ID Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
