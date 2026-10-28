import React, { useMemo } from 'react';
import { Student } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { Printer, X, ShieldCheck, CreditCard } from 'lucide-react';

interface StudentIdCardsA4PrintModalProps {
  students: Student[];
  onClose: () => void;
}

export const StudentIdCardsA4PrintModal: React.FC<StudentIdCardsA4PrintModalProps> = ({
  students,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  // Chunk students into pages of 10 cards per A4 sheet (2 columns x 5 rows)
  const CARDS_PER_PAGE = 10;
  const pages = useMemo(() => {
    const result: Student[][] = [];
    for (let i = 0; i < students.length; i += CARDS_PER_PAGE) {
      result.push(students.slice(i, i + CARDS_PER_PAGE));
    }
    return result;
  }, [students]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl max-w-5xl w-full flex flex-col my-6 print:m-0 print:p-0 print:border-none print:shadow-none print:bg-transparent">
        {/* Modal Header (Hidden in Print) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D] shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                A4 Batch Student ID Cards Print Layout (85.6 × 54.0 mm)
              </h2>
              <p className="text-xs text-gray-500">
                {students.length} student ID card(s) selected · Formatted 2×5 grid per A4 sheet (10 cards per page) with cut lines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold rounded-md shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print {students.length} ID Card(s)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Callout Banner (Hidden in Print) */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs text-gray-700 flex items-center justify-between print:hidden">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#15803D]" />
            <span>
              Each card is sized to exact ISO/IEC 7810 ID-1 standard (85.6 mm × 54.0 mm) with photo, department, and Code 128 quiet zone barcode.
            </span>
          </span>
          <span className="font-semibold text-gray-900 shrink-0 ml-2">
            {pages.length} A4 Sheet(s) Total
          </span>
        </div>

        {/* Printable Target Container */}
        <div className="p-6 bg-gray-100 overflow-y-auto max-h-[75vh] print:p-0 print:bg-white print:max-h-none">
          <div id="printable-a4-student-cards" className="space-y-8 print:space-y-0">
            {pages.map((pageStudents, pageIdx) => (
              <div
                key={pageIdx}
                className="a4-page-grid bg-white p-6 rounded-lg shadow-sm border border-gray-300 mx-auto print:shadow-none print:border-none print:p-0"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  boxSizing: 'border-box',
                }}
              >
                {/* Page Number Indicator (Hidden in print) */}
                <div className="text-right text-[10px] text-gray-400 font-mono mb-3 print:hidden">
                  A4 Page {pageIdx + 1} of {pages.length} ({pageStudents.length} cards)
                </div>

                {/* 2 columns x 5 rows grid */}
                <div
                  className="grid grid-cols-2 gap-x-4 gap-y-3 justify-center items-center print:gap-x-[4mm] print:gap-y-[4mm]"
                  style={{
                    gridTemplateColumns: 'repeat(2, 85.6mm)',
                  }}
                >
                  {pageStudents.map((stu) => {
                    const isPhotoUrl = stu.photo && (stu.photo.startsWith('http') || stu.photo.startsWith('data:image'));
                    const isBlocked = stu.status === 'SUSPENDED';

                    return (
                      <div
                        key={stu.id}
                        className="student-card-item relative select-none rounded-[3.18mm] overflow-hidden bg-white text-gray-900 border border-dashed border-gray-300 print:border-gray-400 shadow-2xs print:shadow-none"
                        style={{
                          width: '85.6mm',
                          height: '54.0mm',
                          minWidth: '85.6mm',
                          minHeight: '54.0mm',
                          maxWidth: '85.6mm',
                          maxHeight: '54.0mm',
                          boxSizing: 'border-box',
                          padding: '2.5mm 3.0mm',
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
                        {/* 1. Institutional Header Banner */}
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-[#15803D] text-white flex items-center justify-center font-bold text-[9px]">
                              <ShieldCheck className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-[9.5px] font-black tracking-tight text-gray-900 uppercase">
                              Campus Student ID Card
                            </span>
                          </div>
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                              isBlocked
                                ? 'bg-red-50 text-[#DC2626] border-red-200'
                                : 'bg-green-50 text-[#15803D] border-green-200'
                            }`}
                          >
                            {isBlocked ? 'SUSPENDED' : 'CAMPUS ACTIVE'}
                          </span>
                        </div>

                        {/* 2. Main Identity Body */}
                        <div className="flex items-center gap-2.5 my-auto">
                          {/* Student Photo */}
                          {isPhotoUrl ? (
                            <img
                              src={stu.photo}
                              alt={stu.fullName}
                              className="w-[14.5mm] h-[17.5mm] rounded object-cover border border-gray-300 shrink-0"
                            />
                          ) : (
                            <div className="w-[14.5mm] h-[17.5mm] rounded bg-gray-100 border border-gray-300 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0">
                              {stu.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                            </div>
                          )}

                          {/* Student Details */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10.5px] font-extrabold text-gray-900 truncate leading-tight">
                              {stu.fullName}
                            </div>

                            <div className="mt-0.5 flex items-center gap-1">
                              <span className="text-[8.5px] font-mono font-bold px-1 py-0.2 rounded bg-gray-100 border border-gray-200 text-gray-800">
                                {stu.id}
                              </span>
                            </div>

                            <div className="mt-1 text-[8px] text-gray-600 font-medium truncate">
                              <strong>Dept:</strong> {stu.department}
                            </div>
                            <div className="text-[7.5px] text-gray-500 font-medium truncate">
                              <strong>Level:</strong> {stu.level}
                            </div>
                          </div>
                        </div>

                        {/* 3. Code 128 Barcode with Quiet Zone */}
                        <div className="bg-white border border-gray-200 rounded p-0.5 flex items-center justify-center shadow-2xs">
                          <BarcodeRenderer
                            value={stu.id}
                            height={18}
                            moduleWidth={1.0}
                            showText={true}
                            lightBackground={false}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Embedded Print CSS for A4 Sheet Grid */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-a4-student-cards,
          #printable-a4-student-cards * {
            visibility: visible !important;
          }
          #printable-a4-student-cards {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: white !important;
          }
          .a4-page-grid {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .a4-page-grid:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}</style>
    </div>
  );
};
