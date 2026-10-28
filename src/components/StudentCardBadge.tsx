import React, { useState } from 'react';
import { Student } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { StudentIdCardPrint } from './StudentIdCardPrint';
import { ShieldCheck, GraduationCap, Building2, Phone, Mail, Printer, Utensils, Moon, X } from 'lucide-react';

interface StudentCardBadgeProps {
  student: Student;
  onSimulateScan?: (barcode: string) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const StudentCardBadge: React.FC<StudentCardBadgeProps> = ({
  student,
  onSimulateScan,
  onClose,
  isModal = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPrintCardOpen, setIsPrintCardOpen] = useState(false);

  const isImageUrl =
    student.photo &&
    (student.photo.startsWith('http') || student.photo.startsWith('data:image'));

  const handlePrint = () => {
    setIsPrintCardOpen(true);
  };

  const cardContent = (
    <div className="flex flex-col items-center">
      {/* Front / Back Toggle Buttons */}
      <div className="flex items-center gap-2 mb-3 print:hidden">
        <button
          type="button"
          onClick={() => setIsFlipped(false)}
          className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
            !isFlipped
              ? 'bg-[#15803D] text-white border-[#15803D]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Front Face
        </button>
        <button
          type="button"
          onClick={() => setIsFlipped(true)}
          className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
            isFlipped
              ? 'bg-[#15803D] text-white border-[#15803D]'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Back & Privileges
        </button>
      </div>

      {/* The Physical Card Container */}
      <div className="relative w-80 h-120 rounded-lg bg-white border border-gray-300 shadow-md p-5 flex flex-col justify-between overflow-hidden text-gray-900 select-none">
        {!isFlipped ? (
          /* FRONT SIDE */
          <>
            {/* Header / Collegiate Emblem */}
            <div className="flex items-start justify-between border-b border-gray-200 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[#15803D]">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wider uppercase">Metropolitan Institute</span>
                </div>
                <div className="text-[11px] text-gray-500 tracking-tight mt-0.5">
                  CAMPUS SMART ACCESS BADGE
                </div>
              </div>
              <div className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>

            {/* Student Photo & Identity Core */}
            <div className="flex flex-col items-center my-auto py-2">
              <div className="relative mb-3">
                <div
                  className="w-24 h-24 rounded-lg flex items-center justify-center text-2xl font-bold text-white shadow-xs border border-gray-300 overflow-hidden bg-[#15803D]"
                >
                  {isImageUrl ? (
                    <img
                      src={student.photo}
                      alt={student.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>
                      {student.fullName
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  )}
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    student.status === 'ACTIVE'
                      ? 'bg-green-50 border-green-200 text-[#15803D]'
                      : 'bg-red-50 border-red-200 text-[#DC2626]'
                  }`}
                >
                  {student.status}
                </div>
              </div>

              <h2 className="text-lg font-bold text-gray-900 tracking-tight text-center">
                {student.fullName}
              </h2>
              <div className="text-xs font-bold text-[#15803D] mt-0.5">
                {student.department}
              </div>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <span>{student.level}</span>
                <span>·</span>
                <span>ID: <strong>{student.id}</strong></span>
              </div>
            </div>

            {/* Bottom Barcode */}
            <div className="pt-3 border-t border-gray-200 flex flex-col items-center">
              <div className="bg-white p-1 rounded border border-gray-200 shadow-xs">
                <BarcodeRenderer
                  value={student.id}
                  height={28}
                  moduleWidth={1.2}
                  showText={false}
                  lightBackground={false}
                />
              </div>
              <span className="text-xs font-bold tracking-wider text-gray-800 mt-1">
                {student.id}
              </span>
            </div>
          </>
        ) : (
          /* BACK SIDE */
          <>
            <div className="border-b border-gray-200 pb-2">
              <div className="text-xs font-bold text-gray-900 uppercase">
                Access Authorization & Credentials
              </div>
              <div className="text-[11px] text-gray-500">Security Clearance Ledger</div>
            </div>

            <div className="space-y-3 my-auto py-2 text-xs">
              <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200 space-y-1">
                <div className="text-[10px] text-gray-500 uppercase font-semibold">Contact Registry</div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  <span className="truncate">{student.email || `${student.id.toLowerCase()}@campus.edu`}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  <span>{student.phone || '+1 (555) 019-2834'}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200 space-y-2">
                <div className="text-[10px] text-gray-500 uppercase font-semibold">Authorized Privileges</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-700">
                    <Utensils className="w-3.5 h-3.5 text-[#15803D]" />
                    Campus Dining Hall:
                  </span>
                  <span className={`font-bold ${student.mealEligible ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>
                    {student.mealEligible ? 'ENROLLED' : 'NO MEAL PLAN'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-gray-700">
                    <Moon className="w-3.5 h-3.5 text-[#15803D]" />
                    Night Curfew:
                  </span>
                  <span className={`font-bold ${student.curfewExempt ? 'text-[#15803D]' : 'text-gray-600'}`}>
                    {student.curfewExempt ? '24/7 EXEMPT' : 'STANDARD (22:00)'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-md bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
                <span className="text-gray-600">Current Presence:</span>
                <span className={`font-bold ${student.currentState === 'IN' ? 'text-[#15803D]' : 'text-gray-500'}`}>
                  {student.currentState === 'IN' ? 'ON CAMPUS' : 'OFF CAMPUS'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 text-center text-[10px] text-gray-500">
              Property of Metropolitan Institute. Found cards must be returned to Campus Safety.
            </div>
          </>
        )}
      </div>

      {/* Card Action Buttons (Simulate Scan & Print ID Card) */}
      <div className="flex items-center gap-2 mt-4 print:hidden">
        {onSimulateScan && (
          <button
            type="button"
            onClick={() => onSimulateScan(student.id)}
            className="px-3.5 py-1.5 rounded-md bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Simulate Scan
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Physical Card</span>
        </button>
      </div>

      {isPrintCardOpen && (
        <StudentIdCardPrint
          student={student}
          onClose={() => setIsPrintCardOpen(false)}
        />
      )}
    </div>
  );

  if (!isModal) {
    return cardContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl relative max-w-sm w-full text-gray-900 max-h-[94vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 text-gray-400 hover:text-gray-700 rounded-md cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>
        {cardContent}
      </div>
    </div>
  );
};
