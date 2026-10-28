import React, { useState, useEffect, useMemo } from 'react';
import { Student, MealLog, MealCard } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { StudentIdCardPrint } from './StudentIdCardPrint';
import { StudentCardBadge } from './StudentCardBadge';
import { MealCardsA4PrintModal, PrintableMealCardItem } from './MealCardsA4PrintModal';
import { IssueMealCardModal } from './IssueMealCardModal';
import { 
  Utensils, 
  Search, 
  Printer, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  CreditCard,
  Building,
  UserCheck,
  UserX,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Sparkles,
  CheckSquare,
  Square,
  Filter,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Grid,
  List
} from 'lucide-react';

interface MealCardsViewProps {
  students: Student[];
  mealCards: MealCard[];
  mealLogs?: MealLog[];
  onUpdateStudent: (id: string, updates: Partial<Student>) => void;
  onCreateMealCard: (card: MealCard) => Promise<void>;
  onUpdateMealCard: (cardNumber: string, updates: Partial<MealCard>) => Promise<void>;
  onReplaceMealCard: (studentId: string, oldCardNumber: string | undefined, newCardNumber: string, studentName?: string) => Promise<void>;
  onBulkIssueMealCards: (items: { studentId: string; studentName: string; cardNumber: string }[]) => Promise<void>;
}

export const MealCardsView: React.FC<MealCardsViewProps> = ({
  students,
  mealCards,
  mealLogs = [],
  onUpdateStudent,
  onCreateMealCard,
  onUpdateMealCard,
  onReplaceMealCard,
  onBulkIssueMealCards,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'unissued'>('all');

  // Fullscreen and View mode state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Escape listener to exit fullscreen
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

  // Checkbox multi-selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Modals state
  const [issueModalTarget, setIssueModalTarget] = useState<{
    student: Student;
    existingCard?: MealCard;
    mode: 'issue' | 'replace';
  } | null>(null);

  const [printSingleStudent, setPrintSingleStudent] = useState<Student | null>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [showA4BatchModal, setShowA4BatchModal] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department));
    return Array.from(set).sort();
  }, [students]);

  // Map each student to their active / latest mealCard
  const studentCardMap = useMemo(() => {
    const map = new Map<string, MealCard | undefined>();
    students.forEach((stu) => {
      const cards = mealCards.filter((c) => c.studentId === stu.id);
      // Prefer ACTIVE card, or latest blocked card
      const activeCard = cards.find((c) => c.status === 'ACTIVE') || cards[0];
      map.set(stu.id, activeCard);
    });
    return map;
  }, [students, mealCards]);

  // Summary Metrics
  const activeCardsCount = useMemo(() => mealCards.filter((c) => c.status === 'ACTIVE').length, [mealCards]);
  const blockedCardsCount = useMemo(() => mealCards.filter((c) => c.status === 'BLOCKED').length, [mealCards]);
  const unissuedCount = useMemo(() => students.filter((s) => !studentCardMap.get(s.id) || studentCardMap.get(s.id)?.status !== 'ACTIVE').length, [students, studentCardMap]);

  // Today's Meals Served Count
  const todayStr = new Date().toISOString().slice(0, 10);
  const mealsServedToday = useMemo(() => {
    return mealLogs.filter((m) => {
      const logDate = m.date || (m.timestamp ? m.timestamp.slice(0, 10) : '');
      return logDate === todayStr && m.status === 'GRANTED';
    }).length;
  }, [mealLogs, todayStr]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    const lower = searchTerm.toLowerCase().trim();
    return students.filter((stu) => {
      const card = studentCardMap.get(stu.id);
      const cardNumber = card?.cardNumber || '';

      const matchesSearch =
        stu.id.toLowerCase().includes(lower) ||
        stu.fullName.toLowerCase().includes(lower) ||
        stu.department.toLowerCase().includes(lower) ||
        cardNumber.toLowerCase().includes(lower);

      const matchesDept = departmentFilter === 'all' || stu.department === departmentFilter;

      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = card?.status === 'ACTIVE';
      } else if (statusFilter === 'blocked') {
        matchesStatus = card?.status === 'BLOCKED';
      } else if (statusFilter === 'unissued') {
        matchesStatus = !card || card.status !== 'ACTIVE';
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [students, searchTerm, departmentFilter, statusFilter, studentCardMap]);

  // Selection toggle helpers
  const allFilteredSelected = useMemo(() => {
    if (filteredStudents.length === 0) return false;
    return filteredStudents.every((s) => selectedStudentIds.includes(s.id));
  }, [filteredStudents, selectedStudentIds]);

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredStudents.some((f) => f.id === id)));
    } else {
      const newIds = new Set([...selectedStudentIds, ...filteredStudents.map((s) => s.id)]);
      setSelectedStudentIds(Array.from(newIds));
    }
  };

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Block / Unblock card action
  const handleToggleCardBlock = async (student: Student, card: MealCard) => {
    const nextStatus = card.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await onUpdateMealCard(card.cardNumber, { status: nextStatus });
      showNotification(
        nextStatus === 'BLOCKED'
          ? `Blocked meal card ${card.cardNumber} for ${student.fullName}.`
          : `Unblocked meal card ${card.cardNumber} for ${student.fullName}.`
      );
    } catch (err: unknown) {
      console.error('Toggle card block error:', err);
      showNotification('Failed to update card status.');
    }
  };

  // Bulk Issue Cards for selected students
  const handleBulkIssueCards = async () => {
    const selectedStudents = students.filter((s) => selectedStudentIds.includes(s.id));
    if (selectedStudents.length === 0) return;

    setIsBulkProcessing(true);

    try {
      // Find highest card number sequence among existing meal cards
      let maxNum = 100;
      mealCards.forEach((c) => {
        const match = c.cardNumber.match(/^MC-(\d+)$/i);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });

      const batchItems: { studentId: string; studentName: string; cardNumber: string }[] = [];
      let currentSeq = maxNum;

      selectedStudents.forEach((stu) => {
        const existingActive = mealCards.find((c) => c.studentId === stu.id && c.status === 'ACTIVE');
        if (!existingActive) {
          currentSeq += 1;
          const newCode = `MC-${String(currentSeq).padStart(6, '0')}`;
          batchItems.push({
            studentId: stu.id,
            studentName: stu.fullName,
            cardNumber: newCode,
          });
        }
      });

      if (batchItems.length === 0) {
        showNotification('All selected students already have active meal cards.');
        setIsBulkProcessing(false);
        return;
      }

      await onBulkIssueMealCards(batchItems);
      showNotification(`Successfully issued ${batchItems.length} new meal card(s).`);
    } catch (err: unknown) {
      console.error('Bulk issue error:', err);
      showNotification('Failed to bulk issue cards.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Prepare items for A4 Sheet Batch Print
  const printableBatchItems: PrintableMealCardItem[] = useMemo(() => {
    const selectedStudents = students.filter((s) => selectedStudentIds.includes(s.id));
    const targetStudents = selectedStudents.length > 0 ? selectedStudents : filteredStudents;

    return targetStudents.map((stu) => ({
      student: stu,
      mealCard: studentCardMap.get(stu.id),
    }));
  }, [students, selectedStudentIds, filteredStudents, studentCardMap]);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-gray-50 flex flex-col p-3 sm:p-6 overflow-y-auto space-y-5' : 'space-y-6'}>
      {/* Toast Notification */}
      {notification && (
        <div className="p-3.5 rounded-md bg-green-50 border border-green-200 text-[#15803D] text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header and Introduction */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-[#15803D]" />
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              {isFullscreen ? 'Meal Cards & Dining Access Console (Full Screen)' : 'Student Meal Cards & Dining Access'}
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            Issue physical PVC meal cards, replace lost badges, toggle block status, and bulk print ISO 85.6 × 54.0 mm cards on A4 sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* View Mode Toggle (Table vs Cards) */}
          <div className="flex items-center p-0.5 rounded-md border border-gray-300 bg-gray-50">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-2xs text-[#15803D]' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow-2xs text-[#15803D]' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Cards Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowA4BatchModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print A4 Batch Sheets</span>
            <span className="sm:hidden">Print A4</span>
            <span>({printableBatchItems.length})</span>
          </button>

          {/* Full Screen Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 shadow-2xs'
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Expand to Full Screen Mode'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-700" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Full Screen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Row (2 columns on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Students</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{students.length}</div>
          <div className="text-[11px] text-gray-500 mt-1">Enrolled campus roster</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Meal Cards</div>
          <div className="text-2xl sm:text-3xl font-bold text-[#15803D] mt-1">{activeCardsCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Active cards in registry</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Blocked Cards</div>
          <div className="text-2xl sm:text-3xl font-bold text-[#DC2626] mt-1">{blockedCardsCount}</div>
          <div className="text-[11px] text-gray-500 mt-1">Lost / Revoked cards</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm">
          <div className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Meals Served Today</div>
          <div className="text-2xl sm:text-3xl font-bold text-[#15803D] mt-1">{mealsServedToday}</div>
          <div className="text-[11px] text-gray-500 mt-1">Validated cafeteria meals</div>
        </div>
      </div>

      {/* Search & Bulk Selection Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input & Filters */}
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student ID, name, or card number..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'blocked' | 'unissued')}
              className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
            >
              <option value="all">All Card Statuses</option>
              <option value="active">Active Cards Only</option>
              <option value="blocked">Blocked Cards Only</option>
              <option value="unissued">Unissued (No Card)</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="text-xs text-gray-500">
            Showing <strong className="text-gray-900">{filteredStudents.length}</strong> of {students.length} students
          </div>
        </div>

        {/* Multi-Selection Actions Bar (Shown when students are selected) */}
        {selectedStudentIds.length > 0 && (
          <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-green-50/50 p-2.5 rounded-md border border-green-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
              <span className="w-6 h-6 rounded-full bg-[#15803D] text-white flex items-center justify-center font-bold text-[11px]">
                {selectedStudentIds.length}
              </span>
              <span>Student(s) Selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkIssueCards}
                disabled={isBulkProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bulk Issue Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setShowA4BatchModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Print Selected (A4)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2 py-1 cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Mode 1: Cards Grid View */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500 shadow-sm">
              No students found matching the selected search or status filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map((stu) => {
                const card = studentCardMap.get(stu.id);
                const isSelected = selectedStudentIds.includes(stu.id);
                const isPhotoUrl = stu.photo && (stu.photo.startsWith('http') || stu.photo.startsWith('data:image'));
                const isActive = card?.status === 'ACTIVE';
                const isBlocked = card?.status === 'BLOCKED';
                const barcodeValue = card?.cardNumber || stu.id;

                return (
                  <div
                    key={stu.id}
                    className={`bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#15803D] ring-2 ring-emerald-500/20 bg-green-50/20'
                        : isBlocked
                        ? 'border-red-200 bg-red-50/10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card: Checkbox + Status Badge */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(stu.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#15803D] focus:ring-[#15803D] cursor-pointer"
                          />
                          <span className="text-[11px] font-mono font-bold text-gray-500">{stu.id}</span>
                        </label>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 border border-green-200 text-[#15803D] font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ACTIVE</span>
                          </span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-[#DC2626] font-bold text-[10px]">
                            <Lock className="w-3 h-3" />
                            <span>BLOCKED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-600 font-medium text-[10px]">
                            <XCircle className="w-3 h-3 text-gray-400" />
                            <span>UNISSUED</span>
                          </span>
                        )}
                      </div>

                      {/* Student Body */}
                      <div className="flex items-start gap-3 py-3">
                        {isPhotoUrl ? (
                          <img
                            src={stu.photo}
                            alt={stu.fullName}
                            className="w-14 h-14 rounded-md object-cover border border-gray-200 shrink-0 shadow-2xs"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-md flex items-center justify-center font-bold text-base text-white shrink-0 bg-[#15803D] shadow-2xs">
                            {stu.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{stu.fullName}</h4>
                          <div className="text-xs text-gray-600 truncate mt-0.5">{stu.department}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{stu.level}</div>
                        </div>
                      </div>

                      {/* Card Number and Barcode */}
                      <div className="bg-gray-50 rounded-md p-2.5 border border-gray-200 space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Meal Credential:</span>
                          {card ? (
                            <span className="font-mono font-bold text-[#15803D]">{card.cardNumber}</span>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">No active card</span>
                          )}
                        </div>
                        <div className="bg-white p-1 rounded border border-gray-200 flex justify-center">
                          <BarcodeRenderer
                            value={barcodeValue}
                            height={22}
                            moduleWidth={1.0}
                            showText={false}
                            lightBackground={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
                      {!card ? (
                        <button
                          type="button"
                          onClick={() => setIssueModalTarget({ student: stu, mode: 'issue' })}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Issue Card</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => setIssueModalTarget({ student: stu, existingCard: card, mode: 'replace' })}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                            title="Replace lost or damaged card"
                          >
                            <RefreshCw className="w-3 h-3 text-gray-500" />
                            <span>Replace</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleCardBlock(stu, card)}
                            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-white hover:bg-red-50 text-[#DC2626] border-red-200'
                                : 'bg-green-50 hover:bg-green-100 text-[#15803D] border-green-300'
                            }`}
                            title={isActive ? 'Block meal card' : 'Unblock meal card'}
                          >
                            {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrintSingleStudent(stu)}
                            className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                            title="Print ISO ID Card (85.6 × 54.0 mm)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* View Mode 2: Students & Meal Cards Table */
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-600 uppercase font-semibold">
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-gray-500 hover:text-gray-900 cursor-pointer"
                      title="Select All Filtered"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#15803D]" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Department & Level</th>
                  <th className="py-3 px-4">Meal Card Number</th>
                  <th className="py-3 px-4">Card Status</th>
                  <th className="py-3 px-4">Code 128 Barcode</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No students found matching the selected search or status filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu) => {
                    const card = studentCardMap.get(stu.id);
                    const isSelected = selectedStudentIds.includes(stu.id);
                    const isPhotoUrl = stu.photo && (stu.photo.startsWith('http') || stu.photo.startsWith('data:image'));
                    const isActive = card?.status === 'ACTIVE';
                    const isBlocked = card?.status === 'BLOCKED';
                    const barcodeValue = card?.cardNumber || stu.id;

                    return (
                      <tr
                        key={stu.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-green-50/40 hover:bg-green-50/70' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(stu.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#15803D] focus:ring-[#15803D] cursor-pointer"
                          />
                        </td>

                        {/* Photo & Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {isPhotoUrl ? (
                              <img
                                src={stu.photo}
                                alt={stu.fullName}
                                className="w-9 h-9 rounded-md object-cover border border-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 bg-[#15803D]">
                                {stu.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-gray-900 block leading-tight">{stu.fullName}</span>
                              <span className="text-[11px] text-gray-500 font-mono">ID: {stu.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{stu.department}</div>
                          <div className="text-[11px] text-gray-500">{stu.level}</div>
                        </td>

                        {/* Card Number */}
                        <td className="py-3 px-4">
                          {card ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-50 border border-green-200 text-[#15803D] font-mono font-bold text-xs shadow-2xs">
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>{card.cardNumber}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-300 text-gray-500 text-[11px]">
                              No Card Issued
                            </span>
                          )}
                        </td>

                        {/* Card Status */}
                        <td className="py-3 px-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-green-50 border border-green-200 text-[#15803D] font-bold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ACTIVE</span>
                            </span>
                          ) : isBlocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-50 border border-red-200 text-[#DC2626] font-bold text-xs">
                              <Lock className="w-3.5 h-3.5" />
                              <span>BLOCKED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 border border-gray-300 text-gray-600 font-medium text-xs">
                              <XCircle className="w-3.5 h-3.5 text-gray-400" />
                              <span>UNISSUED</span>
                            </span>
                          )}
                        </td>

                        {/* Code 128 Barcode */}
                        <td className="py-3 px-4">
                          <div className="bg-white px-2 py-0.5 rounded border border-gray-200 inline-block shadow-2xs">
                            <BarcodeRenderer
                              value={barcodeValue}
                              height={18}
                              moduleWidth={1.0}
                              showText={false}
                              lightBackground={false}
                            />
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Issue Card Button (if unissued) */}
                            {!card && (
                              <button
                                type="button"
                                onClick={() => setIssueModalTarget({ student: stu, mode: 'issue' })}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                title="Issue new meal card"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Issue Card</span>
                              </button>
                            )}

                            {/* Replace Lost Card Button (if card exists) */}
                            {card && (
                              <button
                                type="button"
                                onClick={() => setIssueModalTarget({ student: stu, existingCard: card, mode: 'replace' })}
                                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                                title="Replace lost or damaged card (blocks old card)"
                              >
                                <RefreshCw className="w-3 h-3 text-gray-600" />
                                <span>Replace</span>
                              </button>
                            )}

                            {/* Block / Unblock Toggle Button */}
                            {card && (
                              <button
                                type="button"
                                onClick={() => handleToggleCardBlock(stu, card)}
                                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-white hover:bg-red-50 text-[#DC2626] border-red-200'
                                    : 'bg-green-50 hover:bg-green-100 text-[#15803D] border-green-300'
                                }`}
                                title={isActive ? 'Block meal card' : 'Unblock meal card'}
                              >
                                {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            )}

                            {/* Preview / Single Print */}
                            <button
                              type="button"
                              onClick={() => setPrintSingleStudent(stu)}
                              className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                              title="Print ISO ID Card (85.6 × 54.0 mm)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue / Replace Card Modal */}
      {issueModalTarget && (
        <IssueMealCardModal
          student={issueModalTarget.student}
          existingCard={issueModalTarget.existingCard}
          mode={issueModalTarget.mode}
          existingMealCards={mealCards}
          onConfirm={async (studentId, oldCardNumber, newCardNumber) => {
            if (issueModalTarget.mode === 'replace') {
              await onReplaceMealCard(studentId, oldCardNumber, newCardNumber, issueModalTarget.student.fullName);
              showNotification(`Replaced card for ${issueModalTarget.student.fullName}. New Card: ${newCardNumber}`);
            } else {
              await onCreateMealCard({
                cardNumber: newCardNumber,
                studentId,
                status: 'ACTIVE',
                studentName: issueModalTarget.student.fullName,
                createdAt: new Date().toISOString(),
              });
              await onUpdateStudent(studentId, { mealEligible: true });
              showNotification(`Issued meal card ${newCardNumber} to ${issueModalTarget.student.fullName}.`);
            }
          }}
          onClose={() => setIssueModalTarget(null)}
        />
      )}

      {/* Single ID Card Print Modal */}
      {printSingleStudent && (
        <StudentIdCardPrint
          student={printSingleStudent}
          onClose={() => setPrintSingleStudent(null)}
        />
      )}

      {/* Batch A4 Printable Sheet Modal (85.6 x 54 mm cards in 2x5 grid) */}
      {showA4BatchModal && (
        <MealCardsA4PrintModal
          items={printableBatchItems}
          onClose={() => setShowA4BatchModal(false)}
        />
      )}
    </div>
  );
};
