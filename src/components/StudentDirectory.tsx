import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, StudentStatus, StudentState } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { StudentIdCardPrint } from './StudentIdCardPrint';
import { StudentIdCardsA4PrintModal } from './StudentIdCardsA4PrintModal';
import { uploadStudentPhoto } from '../services/storageService';
import { 
  parseStudentsCSV, 
  getSampleStudentCSVTemplate, 
  CSVParseResult 
} from '../utils/csvImport';
import { StudentRegistrationPage } from './StudentRegistrationPage';
import { 
  Search, 
  Plus, 
  UserPlus,
  UserCheck, 
  UserX, 
  Download, 
  Upload,
  Eye, 
  Edit3, 
  IdCard, 
  ShieldAlert,
  Utensils,
  Moon,
  Check,
  Trash2,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  HelpCircle,
  Grid,
  List
} from 'lucide-react';

interface StudentDirectoryProps {
  students: Student[];
  onSelectStudentForBadge: (student: Student) => void;
  onAddStudent: (newStudent: Student) => void;
  onBatchAddStudents?: (newStudents: Student[]) => Promise<void>;
  onUpdateStudent: (id: string, updates: Partial<Student>) => void;
  onDeleteStudent?: (id: string) => void;
  onSimulateScan: (barcode: string) => void;
  initialTab?: 'directory' | 'register';
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  onSelectStudentForBadge,
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onSimulateScan,
  initialTab = 'directory',
}) => {
  const [activeTopTab, setActiveTopTab] = useState<'directory' | 'register'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTopTab(initialTab);
    }
  }, [initialTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [printCardStudent, setPrintCardStudent] = useState<Student | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [showA4PrintModal, setShowA4PrintModal] = useState(false);
  
  // Feedback toast / notification
  const [actionNotification, setActionNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // Selected students for bulk actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // New Student Form State
  const [newId, setNewId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Computer Science');
  const [newLevel, setNewLevel] = useState('Year 1');
  const [newStatus, setNewStatus] = useState<StudentStatus>('ACTIVE');
  const [newCurfewExempt, setNewCurfewExempt] = useState(false);
  const [newMealEligible, setNewMealEligible] = useState(true);
  const [newCurrentState, setNewCurrentState] = useState<StudentState>('OUT');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Edit Student Photo Upload State
  const [isEditUploadingPhoto, setIsEditUploadingPhoto] = useState(false);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [csvParseResult, setCsvParseResult] = useState<CSVParseResult | null>(null);
  const [csvActiveTab, setCsvActiveTab] = useState<'valid' | 'invalid'>('valid');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (message: string, type: 'success' | 'warning' = 'success') => {
    setActionNotification({ message, type });
    setTimeout(() => {
      setActionNotification(null);
    }, 4000);
  };

  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department));
    return Array.from(set).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase().trim();
    return students.filter((stu) => {
      const matchesSearch =
        stu.id.toLowerCase().includes(lowerSearch) ||
        stu.fullName.toLowerCase().includes(lowerSearch) ||
        stu.department.toLowerCase().includes(lowerSearch) ||
        stu.level.toLowerCase().includes(lowerSearch);

      const matchesStatus = statusFilter === 'all' || stu.status === statusFilter;
      const matchesState = stateFilter === 'all' || stu.currentState === stateFilter;
      const matchesDept = departmentFilter === 'all' || stu.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesState && matchesDept;
    });
  }, [students, searchTerm, statusFilter, stateFilter, departmentFilter]);

  // Bulk selection helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredStudents.map((s) => s.id));
      setSelectedStudentIds(allIds);
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // One-click Block / Unblock actions
  const handleToggleBlockStudent = (stu: Student) => {
    const nextStatus: StudentStatus = stu.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    onUpdateStudent(stu.id, { status: nextStatus });
    if (nextStatus === 'SUSPENDED') {
      showNotification(`Blocked student ${stu.fullName} (${stu.id}). All gate & meal access revoked.`, 'warning');
    } else {
      showNotification(`Unblocked student ${stu.fullName} (${stu.id}). Active campus access restored.`, 'success');
    }
  };

  // Bulk Block / Unblock
  const handleBulkBlock = () => {
    if (selectedStudentIds.size === 0) return;
    selectedStudentIds.forEach((id) => {
      onUpdateStudent(id, { status: 'SUSPENDED' });
    });
    showNotification(`Blocked ${selectedStudentIds.size} student(s).`, 'warning');
    setSelectedStudentIds(new Set());
  };

  const handleBulkUnblock = () => {
    if (selectedStudentIds.size === 0) return;
    selectedStudentIds.forEach((id) => {
      onUpdateStudent(id, { status: 'ACTIVE' });
    });
    showNotification(`Unblocked ${selectedStudentIds.size} student(s).`, 'success');
    setSelectedStudentIds(new Set());
  };

  // Photo Upload Handler for Register Modal
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempId = newId.trim().toUpperCase() || `TEMP_${Date.now()}`;
    setIsUploadingPhoto(true);
    try {
      const downloadUrl = await uploadStudentPhoto(tempId, file);
      setNewPhotoUrl(downloadUrl);
      showNotification('Photo uploaded to Firebase Storage!', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      showNotification('Failed to upload photo. Please check storage connection.', 'warning');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Photo Upload Handler for Edit Modal
  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingStudent) return;

    setIsEditUploadingPhoto(true);
    try {
      const downloadUrl = await uploadStudentPhoto(editingStudent.id, file);
      setEditingStudent({ ...editingStudent, photo: downloadUrl });
      showNotification('Updated photo uploaded to Firebase Storage!', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      showNotification('Failed to upload photo. Please try a different image.', 'warning');
    } finally {
      setIsEditUploadingPhoto(false);
    }
  };

  // Register Student Submit
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newId.trim().toUpperCase();
    const cleanName = newFullName.trim();
    if (!cleanId || !cleanName) return;

    if (students.some((s) => s.id.toUpperCase() === cleanId)) {
      showNotification(`Student ID "${cleanId}" is already registered. Please choose a unique ID.`, 'warning');
      return;
    }

    const colors = ['#15803D', '#374151', '#4B5563', '#1F2937'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const studentToCreate: Student = {
      id: newId.trim().toUpperCase(),
      fullName: newFullName.trim(),
      department: newDepartment,
      level: newLevel,
      photo: newPhotoUrl || randomColor,
      status: newStatus,
      curfewExempt: newCurfewExempt,
      mealEligible: newMealEligible,
      currentState: newCurrentState,
      email: `${newFullName.toLowerCase().replace(/\s+/g, '.')}@campus.edu`,
      phone: '+1 (555) 000-0000',
    };

    onAddStudent(studentToCreate);
    showNotification(`Student ${studentToCreate.fullName} (${studentToCreate.id}) registered successfully!`, 'success');

    // Reset form
    setNewId('');
    setNewFullName('');
    setNewPhotoUrl('');
    setNewMealEligible(true);
    setNewCurfewExempt(false);
    setIsAddModalOpen(false);
  };

  // Edit Student Submit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStudent(editingStudent.id, {
      fullName: editingStudent.fullName,
      department: editingStudent.department,
      level: editingStudent.level,
      status: editingStudent.status,
      curfewExempt: editingStudent.curfewExempt,
      mealEligible: editingStudent.mealEligible,
      currentState: editingStudent.currentState,
      photo: editingStudent.photo,
    });
    showNotification(`Student ${editingStudent.fullName} (${editingStudent.id}) updated!`, 'success');
    setEditingStudent(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['student_id', 'full_name', 'department', 'level', 'status', 'currentState', 'mealEligible', 'curfewExempt'];
    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.fullName}"`,
      `"${s.department}"`,
      `"${s.level}"`,
      s.status,
      s.currentState,
      s.mealEligible ? 'YES' : 'NO',
      s.curfewExempt ? 'YES' : 'NO',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `students_roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    const sample = getSampleStudentCSVTemplate();
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + sample);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_students_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV file selection and parsing
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        const existingIds = new Set(students.map((s) => s.id.toUpperCase()));
        const parsed = parseStudentsCSV(text, existingIds);
        setCsvParseResult(parsed);
        setCsvActiveTab(parsed.validRows.length > 0 ? 'valid' : 'invalid');
        setCsvImportSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  // Handle Manual CSV Text change
  const handleCsvTextChange = (text: string) => {
    setCsvText(text);
    if (!text.trim()) {
      setCsvParseResult(null);
      return;
    }
    const existingIds = new Set(students.map((s) => s.id.toUpperCase()));
    const parsed = parseStudentsCSV(text, existingIds);
    setCsvParseResult(parsed);
    setCsvActiveTab(parsed.validRows.length > 0 ? 'valid' : 'invalid');
    setCsvImportSuccess(null);
  };

  // Execute CSV Import of valid rows
  const handleConfirmCsvImport = async () => {
    if (!csvParseResult || csvParseResult.validRows.length === 0) return;

    setIsImportingCsv(true);
    try {
      const validStudentsToCreate: Student[] = csvParseResult.validRows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        department: r.department,
        level: r.level,
        status: r.status,
        currentState: r.currentState,
        mealEligible: r.mealEligible,
        curfewExempt: r.curfewExempt,
        photo: r.photo,
        email: r.email,
        phone: r.phone,
      }));

      if (onBatchAddStudents) {
        await onBatchAddStudents(validStudentsToCreate);
      } else {
        for (const stu of validStudentsToCreate) {
          await onAddStudent(stu);
        }
      }

      setCsvImportSuccess(
        `Successfully imported ${validStudentsToCreate.length} valid student(s)! ${
          csvParseResult.invalidRows.length > 0
            ? `(${csvParseResult.invalidRows.length} invalid rows were skipped).`
            : ''
        }`
      );
      showNotification(`Imported ${validStudentsToCreate.length} students from CSV.`, 'success');
      
      // Auto close after brief display
      setTimeout(() => {
        setIsCsvModalOpen(false);
        setCsvFile(null);
        setCsvText('');
        setCsvParseResult(null);
        setCsvImportSuccess(null);
      }, 1800);
    } catch (err) {
      console.error('CSV import error:', err);
      showNotification('Failed to import valid CSV rows. Check console.', 'warning');
    } finally {
      setIsImportingCsv(false);
    }
  };

  // Helper to render student photo in table
  const renderStudentAvatar = (stu: Student) => {
    if (stu.photo && (stu.photo.startsWith('http') || stu.photo.startsWith('data:image'))) {
      return (
        <img
          src={stu.photo}
          alt={stu.fullName}
          className="w-8 h-8 rounded-md object-cover border border-gray-200 shrink-0 shadow-sm"
        />
      );
    }
    return (
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center font-bold text-[11px] text-white shrink-0 shadow-sm bg-[#15803D]"
      >
        {stu.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
      </div>
    );
  };

  const isAllSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.has(s.id));

  return (
    <div className="space-y-5">
      {/* Toast Notification Banner */}
      {actionNotification && (
        <div
          className={`p-3 rounded-md border text-xs font-medium flex items-center justify-between shadow-sm ${
            actionNotification.type === 'success'
              ? 'bg-green-50 border-green-200 text-[#15803D]'
              : 'bg-red-50 border-red-200 text-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
            )}
            <span>{actionNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotification(null)}
            className="text-gray-500 hover:text-gray-800 cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Segmented Navigation Tabs: Directory vs Register Student */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTopTab('directory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTopTab === 'directory'
              ? 'bg-[#15803D] text-white shadow-xs'
              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Student Directory & Roster ({students.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTopTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTopTab === 'register'
              ? 'bg-[#15803D] text-white shadow-xs'
              : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Student</span>
        </button>
      </div>

      {activeTopTab === 'directory' ? (
        <>
          {/* Top Search & Actions Bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, dept, or level..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D]"
            />
          </div>

          {/* Department Filter */}
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">ACTIVE (Authorized)</option>
            <option value="SUSPENDED">SUSPENDED (Blocked)</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          {/* State Filter (IN or OUT) */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
          >
            <option value="all">All States</option>
            <option value="IN">Current: IN (On Campus)</option>
            <option value="OUT">Current: OUT (Off Campus)</option>
          </select>
        </div>

        {/* Action Buttons: View Mode, Print Selected ID Cards, CSV Import, CSV Export, Register Student */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Print Selected ID Cards Button */}
          <button
            type="button"
            onClick={() => setShowA4PrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Print selected or filtered student ID cards on A4 sheets"
          >
            <Printer className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Print ID cards ({selectedStudentIds.size > 0 ? selectedStudentIds.size : filteredStudents.length})</span>
          </button>

          {/* CSV Import Button */}
          <button
            type="button"
            onClick={() => {
              setIsCsvModalOpen(true);
              setCsvImportSuccess(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Import students via CSV file"
          >
            <Upload className="w-3.5 h-3.5 text-[#15803D]" />
            <span>Import CSV</span>
          </button>

          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium transition-colors cursor-pointer"
            title="Export all students to CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>Export CSV</span>
          </button>

          {/* Register Student Button */}
          <button
            type="button"
            onClick={() => setActiveTopTab('register')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      {/* Bulk Actions Floating Toolbar (When students are selected) */}
      {selectedStudentIds.size > 0 && (
        <div className="p-3 bg-gray-50 border border-gray-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <span className="w-5 h-5 rounded-full bg-[#15803D] text-white font-bold flex items-center justify-center text-[10px]">
              {selectedStudentIds.size}
            </span>
            <span>student(s) selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowA4PrintModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#15803D] text-white hover:bg-[#166534] font-semibold cursor-pointer shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print selected ID cards</span>
            </button>
            <button
              type="button"
              onClick={handleBulkBlock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#DC2626] text-white hover:bg-red-700 font-semibold cursor-pointer shadow-sm"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Block Selected (Suspend)</span>
            </button>
            <button
              type="button"
              onClick={handleBulkUnblock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#15803D] text-white hover:bg-[#166534] font-semibold cursor-pointer shadow-sm"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Unblock Selected (Active)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStudentIds(new Set())}
              className="px-2.5 py-1.5 rounded-md text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* View Mode 1: Responsive Cards Grid View */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500 shadow-sm">
              <div className="flex flex-col items-center justify-center gap-2">
                <Search className="w-8 h-8 text-gray-400" />
                <span>No students match the current search or filter criteria.</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map((stu) => {
                const isSelected = selectedStudentIds.has(stu.id);
                const isBlocked = stu.status === 'SUSPENDED';

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
                      {/* Top Header: Checkbox + Status */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(stu.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#15803D] focus:ring-[#15803D] cursor-pointer"
                          />
                          <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-800 font-mono font-bold text-xs">
                            {stu.id}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              stu.status === 'ACTIVE'
                                ? 'bg-green-50 border-green-200 text-[#15803D]'
                                : 'bg-red-50 border-red-200 text-[#DC2626]'
                            }`}
                          >
                            {stu.status}
                          </span>
                        </div>
                      </div>

                      {/* Student Info & Photo */}
                      <div className="flex items-start gap-3 py-3">
                        <div className="shrink-0">{renderStudentAvatar(stu)}</div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{stu.fullName}</h4>
                          <div className="text-xs text-gray-600 truncate mt-0.5">{stu.department}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{stu.level}</div>
                        </div>
                      </div>

                      {/* Presence State and Barcode */}
                      <div className="bg-gray-50 rounded-md p-2.5 border border-gray-200 space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Campus Presence:</span>
                          {stu.currentState === 'IN' ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#15803D] text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                              IN (Campus)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-500 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              OUT (Off-site)
                            </span>
                          )}
                        </div>

                        <div className="bg-white p-1 rounded border border-gray-200 flex justify-center">
                          <BarcodeRenderer
                            value={stu.id}
                            height={20}
                            moduleWidth={1.0}
                            showText={false}
                            lightBackground={false}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPrintCardStudent(stu)}
                        className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                        title="Print ID Card"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSimulateScan(stu.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                        title="Simulate scan at gate"
                      >
                        <IdCard className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>Scan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectStudentForBadge(stu)}
                        className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                        title="View Badge"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingStudent({ ...stu })}
                        className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {onDeleteStudent && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Permanently delete student record for ${stu.fullName} (${stu.id})?`)) {
                              onDeleteStudent(stu.id);
                              showNotification(`Deleted student ${stu.id}.`, 'warning');
                            }
                          }}
                          className="p-1.5 rounded-md bg-white hover:bg-red-50 text-[#DC2626] border border-gray-300 hover:border-red-200 transition-colors cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* View Mode 2: High-Density Students Table */
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[780px]">
              <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-600 uppercase font-semibold">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Student ID</th>
                <th className="py-3 px-4">Full Name & Photo</th>
                <th className="py-3 px-4">Department & Level</th>
                <th className="py-3 px-4">Code 128 Barcode</th>
                <th className="py-3 px-4">Current State</th>
                <th className="py-3 px-4">Status & Block</th>
                <th className="py-3 px-4">Privileges</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-gray-400" />
                      <span>No students match the current search or filter criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const isSelected = selectedStudentIds.has(stu.id);
                  const isBlocked = stu.status === 'SUSPENDED';

                  return (
                    <tr
                      key={stu.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-green-50/40' : ''
                      } ${isBlocked ? 'bg-red-50/20' : ''}`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(stu.id)}
                          className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Student ID */}
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-800">
                          {stu.id}
                        </span>
                      </td>

                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {renderStudentAvatar(stu)}
                          <div>
                            <span className="font-semibold text-gray-900 block">
                              {stu.fullName}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {stu.email || `${stu.id.toLowerCase()}@campus.edu`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Level */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{stu.department}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {stu.level}
                        </div>
                      </td>

                      {/* Barcode SVG Miniature with Quiet Zone */}
                      <td className="py-3 px-4">
                        <div className="bg-white px-2 py-0.5 rounded border border-gray-200 inline-block shadow-sm">
                          <BarcodeRenderer
                            value={stu.id}
                            height={18}
                            moduleWidth={1.1}
                            showText={false}
                            lightBackground={false}
                          />
                        </div>
                      </td>

                      {/* Current State (IN or OUT) */}
                      <td className="py-3 px-4 font-semibold">
                        {stu.currentState === 'IN' ? (
                          <span className="inline-flex items-center gap-1.5 text-[#15803D]">
                            <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                            IN (Campus)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            OUT (Off-site)
                          </span>
                        )}
                      </td>

                      {/* Status & Quick Block / Unblock Toggle */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {stu.status === 'ACTIVE' ? (
                            <span className="text-[#15803D] flex items-center gap-1 text-[11px] font-bold">
                              <UserCheck className="w-3.5 h-3.5" />
                              ACTIVE
                            </span>
                          ) : stu.status === 'SUSPENDED' ? (
                            <span className="text-[#DC2626] flex items-center gap-1 text-[11px] font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              <UserX className="w-3.5 h-3.5" />
                              BLOCKED
                            </span>
                          ) : (
                            <span className="text-[#DC2626] flex items-center gap-1 text-[11px] font-bold">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              EXPIRED
                            </span>
                          )}

                          {/* Quick Block / Unblock Action Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleBlockStudent(stu)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer border ${
                              isBlocked
                                ? 'bg-green-50 hover:bg-green-100 text-[#15803D] border-green-200'
                                : 'bg-white hover:bg-red-50 hover:text-[#DC2626] text-gray-700 border-gray-300 hover:border-red-200'
                            }`}
                            title={isBlocked ? 'Click to Unblock student' : 'Click to Block student (suspend gate access)'}
                          >
                            {isBlocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      </td>

                      {/* Privileges (Meal & Curfew) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                              stu.mealEligible
                                ? 'text-[#15803D] bg-green-50 border-green-200 font-medium'
                                : 'text-gray-400 bg-gray-50 border-gray-200'
                            }`}
                            title={stu.mealEligible ? 'Enrolled in Dining Hall Meal Plan' : 'No Meal Dining Plan'}
                          >
                            <Utensils className="w-3 h-3" />
                            {stu.mealEligible ? 'Meal' : 'No Meal'}
                          </span>
                          {stu.curfewExempt && (
                            <span
                              className="flex items-center gap-1 text-[10px] text-gray-700 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-medium"
                              title="Curfew Exempt: 24/7 night gate access"
                            >
                              <Moon className="w-3 h-3 text-[#15803D]" />
                              24/7
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions: Print ID Card (85.6x54mm), View Badge, Edit, Scan, Delete */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print ID Card (85.6 x 54 mm) */}
                          <button
                            type="button"
                            onClick={() => setPrintCardStudent(stu)}
                            className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-[#15803D] border border-gray-300 transition-colors cursor-pointer"
                            title="Print ID Card (85.6 × 54.0 mm Standard Card with Quiet Zone Barcode)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Simulate Gate Scan */}
                          <button
                            type="button"
                            onClick={() => onSimulateScan(stu.id)}
                            className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                            title="Simulate scan at active gate terminal"
                          >
                            <IdCard className="w-3.5 h-3.5" />
                          </button>

                          {/* View Full Virtual Badge */}
                          <button
                            type="button"
                            onClick={() => onSelectStudentForBadge(stu)}
                            className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                            title="View Full Virtual Badge"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Student */}
                          <button
                            type="button"
                            onClick={() => setEditingStudent({ ...stu })}
                            className="p-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors cursor-pointer"
                            title="Edit student record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Student */}
                          {onDeleteStudent && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Permanently delete student record for ${stu.fullName} (${stu.id})?`)) {
                                  onDeleteStudent(stu.id);
                                  showNotification(`Deleted student ${stu.id}.`, 'warning');
                                }
                              }}
                              className="p-1.5 rounded-md bg-white hover:bg-red-50 text-[#DC2626] border border-gray-300 hover:border-red-200 transition-colors cursor-pointer"
                              title="Delete student from Firestore"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
        </>
      ) : (
        <StudentRegistrationPage
          students={students}
          onAddStudent={onAddStudent}
          onPrintCard={(stu) => setPrintCardStudent(stu)}
          onViewDirectory={() => setActiveTopTab('directory')}
        />
      )}

      {/* MODAL 1: CSV Import with Preview & Valid/Invalid Reasons */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden text-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-[#15803D]">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Import Students from CSV</h3>
                  <p className="text-[11px] text-gray-500">
                    Required Columns: <strong className="text-gray-700">student_id, full_name, department, level</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvFile(null);
                  setCsvText('');
                  setCsvParseResult(null);
                }}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="space-y-4 py-4 overflow-y-auto flex-1 text-xs">
              {/* Instructions and Download Template Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-md bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-700">
                  <HelpCircle className="w-4 h-4 text-[#15803D] shrink-0" />
                  <span>
                    Upload a .csv file or paste formatted CSV text. Valid rows will be imported, and invalid rows are detailed below with reasons.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-semibold shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* File Dropzone & Text Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload File Box */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#15803D] rounded-md p-5 flex flex-col items-center justify-center gap-2 bg-gray-50 cursor-pointer transition-colors text-center"
                >
                  <Upload className="w-6 h-6 text-[#15803D]" />
                  <div className="font-semibold text-gray-900">
                    {csvFile ? csvFile.name : 'Choose CSV File'}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Click to select .csv file from your computer
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                </div>

                {/* Direct Paste Box */}
                <div className="flex flex-col">
                  <label className="text-[11px] text-gray-600 font-medium mb-1">
                    Or paste raw CSV text:
                  </label>
                  <textarea
                    rows={4}
                    value={csvText}
                    onChange={(e) => handleCsvTextChange(e.target.value)}
                    placeholder="student_id,full_name,department,level&#10;CS2026/01-1,Devon Vance,Computer Science,Year 1"
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-md text-gray-900 text-[11px] focus:outline-none focus:border-[#15803D] resize-none flex-1"
                  />
                </div>
              </div>

              {/* Error in header if missing columns */}
              {csvParseResult?.headerError && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-[#DC2626] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                  <span>{csvParseResult.headerError}</span>
                </div>
              )}

              {/* Success Banner */}
              {csvImportSuccess && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 text-[#15803D] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                  <span>{csvImportSuccess}</span>
                </div>
              )}

              {/* CSV Parse Preview Section */}
              {csvParseResult && !csvParseResult.headerError && (
                <div className="space-y-3 pt-2">
                  {/* Summary Metric Pills */}
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
                      Total Rows: <span className="font-bold text-gray-900">{csvParseResult.totalRows}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCsvActiveTab('valid')}
                      className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        csvActiveTab === 'valid'
                          ? 'bg-green-50 border-green-300 text-[#15803D] font-bold'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>Valid Rows ({csvParseResult.validRows.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvActiveTab('invalid')}
                      className={`px-3 py-1.5 rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        csvActiveTab === 'invalid'
                          ? 'bg-red-50 border-red-300 text-[#DC2626] font-bold'
                          : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                      <span>Invalid Rows ({csvParseResult.invalidRows.length})</span>
                    </button>
                  </div>

                  {/* TAB 1: Valid Rows Preview Table */}
                  {csvActiveTab === 'valid' && (
                    <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
                      <div className="max-h-48 overflow-y-auto">
                        {csvParseResult.validRows.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            No valid student rows detected in the provided CSV.
                          </div>
                        ) : (
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                              <tr>
                                <th className="p-2">Row</th>
                                <th className="p-2">Student ID</th>
                                <th className="p-2">Full Name</th>
                                <th className="p-2">Department</th>
                                <th className="p-2">Level</th>
                                <th className="p-2">Initial Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-gray-700">
                              {csvParseResult.validRows.map((r) => (
                                <tr key={r.rowNumber} className="hover:bg-gray-50">
                                  <td className="p-2 text-gray-500">#{r.rowNumber}</td>
                                  <td className="p-2 font-bold text-gray-900">{r.id}</td>
                                  <td className="p-2 font-semibold text-gray-900">{r.fullName}</td>
                                  <td className="p-2">{r.department}</td>
                                  <td className="p-2 text-gray-500">{r.level}</td>
                                  <td className="p-2 text-[#15803D] font-bold">ACTIVE</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Invalid Rows List with Specific Reasons */}
                  {csvActiveTab === 'invalid' && (
                    <div className="border border-red-200 rounded-md overflow-hidden bg-white">
                      <div className="max-h-48 overflow-y-auto">
                        {csvParseResult.invalidRows.length === 0 ? (
                          <div className="p-4 text-center text-[#15803D] flex items-center justify-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Zero errors! All rows in this CSV are valid and ready to import.</span>
                          </div>
                        ) : (
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-red-50 border-b border-red-200 text-[#DC2626] uppercase font-semibold">
                              <tr>
                                <th className="p-2 w-14">Row</th>
                                <th className="p-2">Raw Data</th>
                                <th className="p-2">Rejection Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 text-gray-700">
                              {csvParseResult.invalidRows.map((inv) => (
                                <tr key={inv.rowNumber} className="hover:bg-red-50/40">
                                  <td className="p-2 text-[#DC2626] font-bold">
                                    #{inv.rowNumber}
                                  </td>
                                  <td className="p-2 text-gray-600 truncate max-w-xs" title={inv.rawData}>
                                    {inv.rawData || '(Empty line)'}
                                  </td>
                                  <td className="p-2">
                                    <span className="inline-flex items-center gap-1 text-[#DC2626] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                      <AlertTriangle className="w-3 h-3 text-[#DC2626] shrink-0" />
                                      {inv.reason}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvFile(null);
                  setCsvText('');
                  setCsvParseResult(null);
                }}
                className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!csvParseResult || csvParseResult.validRows.length === 0 || isImportingCsv}
                onClick={handleConfirmCsvImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] disabled:opacity-40 text-white font-semibold shadow-sm cursor-pointer"
              >
                {isImportingCsv ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      Import Valid Rows ({csvParseResult?.validRows.length || 0})
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Register New Student (with Photo Upload via Firebase Storage) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto text-gray-900">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <IdCard className="w-5 h-5 text-[#15803D]" />
                <h3 className="text-base font-bold text-gray-900">Enroll Student Credential</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
              {/* Photo Upload Box (Firebase Storage) */}
              <div className="p-3 rounded-md bg-gray-50 border border-gray-200 flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-md border border-gray-300 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                  {newPhotoUrl ? (
                    <img src={newPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">Student Photo (Firebase Storage)</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Upload JPEG/PNG image for student card & terminal display.
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-[11px] font-semibold cursor-pointer">
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-[#15803D]" />
                          <span>Upload Photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingPhoto}
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {newPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setNewPhotoUrl('')}
                        className="text-[11px] text-[#DC2626] hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Student ID (Barcode & Key) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="e.g. RU0073/16-0"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Format: Letters, digits, slash, hyphen
                  </span>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Alexandre Mercer"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Department</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Biomedical Engineering">Biomedical Engineering</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Robotics">Robotics</option>
                    <option value="Economics">Economics</option>
                    <option value="Medicine">Medicine</option>
                    <option value="Applied Physics">Applied Physics</option>
                    <option value="Law">Law</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Level</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="Year 1">Year 1</option>
                    <option value="Year 2">Year 2</option>
                    <option value="Year 3">Year 3</option>
                    <option value="Year 4">Year 4</option>
                    <option value="Postgraduate">Postgraduate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as StudentStatus)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized)</option>
                    <option value="SUSPENDED">SUSPENDED (Blocked)</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Current State</label>
                  <select
                    value={newCurrentState}
                    onChange={(e) => setNewCurrentState(e.target.value as StudentState)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="OUT">OUT (Off Campus)</option>
                    <option value="IN">IN (On Campus)</option>
                  </select>
                </div>
              </div>

              {/* Meal & Curfew Toggles */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newMeal"
                    checked={newMealEligible}
                    onChange={(e) => setNewMealEligible(e.target.checked)}
                    className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="newMeal" className="text-gray-700 flex items-center gap-1.5 cursor-pointer">
                    <Utensils className="w-3.5 h-3.5 text-[#15803D]" />
                    Meal Eligible (Enrolled in campus dining meal plan)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="newCurfew"
                    checked={newCurfewExempt}
                    onChange={(e) => setNewCurfewExempt(e.target.checked)}
                    className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="newCurfew" className="text-gray-700 flex items-center gap-1.5 cursor-pointer">
                    <Moon className="w-3.5 h-3.5 text-[#15803D]" />
                    Curfew Exempt (24/7 night campus access)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white font-semibold shadow-sm"
                >
                  Save & Issue ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Existing Student (with Photo Upload & Block/Unblock) */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto text-gray-900">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-gray-900">Edit Student Credential</h3>
                <span className="text-gray-600 text-xs font-semibold">{editingStudent.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Photo Upload via Firebase Storage */}
              <div className="p-3 rounded-md bg-gray-50 border border-gray-200 flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-md border border-gray-300 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                  {editingStudent.photo && (editingStudent.photo.startsWith('http') || editingStudent.photo.startsWith('data:image')) ? (
                    <img src={editingStudent.photo} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-bold text-white text-sm bg-[#15803D]"
                    >
                      {editingStudent.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">Change ID Photo</div>
                  <div className="text-[11px] text-gray-500">Firebase Storage</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-[11px] font-semibold cursor-pointer">
                      {isEditUploadingPhoto ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 text-[#15803D]" />
                          <span>Change Photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isEditUploadingPhoto}
                        onChange={handleEditPhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-gray-700 mb-1 font-medium">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              {/* Status (ACTIVE / SUSPENDED-BLOCKED / EXPIRED) */}
              <div>
                <label className="block text-gray-700 mb-1 font-medium">
                  Access Status (Block / Unblock)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent({ ...editingStudent, status: 'ACTIVE' })}
                    className={`py-2 px-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      editingStudent.status === 'ACTIVE'
                        ? 'bg-[#15803D] text-white border-[#15803D]'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStudent({ ...editingStudent, status: 'SUSPENDED' })}
                    className={`py-2 px-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      editingStudent.status === 'SUSPENDED'
                        ? 'bg-[#DC2626] text-white border-[#DC2626]'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    BLOCKED
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStudent({ ...editingStudent, status: 'EXPIRED' })}
                    className={`py-2 px-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      editingStudent.status === 'EXPIRED'
                        ? 'bg-red-50 border-red-300 text-[#DC2626]'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    EXPIRED
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1 font-medium">Department</label>
                  <input
                    type="text"
                    value={editingStudent.department}
                    onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-medium">Level</label>
                  <input
                    type="text"
                    value={editingStudent.level}
                    onChange={(e) => setEditingStudent({ ...editingStudent, level: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
              </div>

              {/* Current Movement State */}
              <div>
                <label className="block text-gray-700 mb-1 font-medium">Current State (On Campus vs Off Campus)</label>
                <select
                  value={editingStudent.currentState}
                  onChange={(e) => setEditingStudent({ ...editingStudent, currentState: e.target.value as StudentState })}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="OUT">OUT (Off Campus)</option>
                  <option value="IN">IN (On Campus)</option>
                </select>
              </div>

              {/* Privileges Toggles */}
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editMeal"
                    checked={editingStudent.mealEligible}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mealEligible: e.target.checked })}
                    className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="editMeal" className="text-gray-700 cursor-pointer flex items-center gap-1.5 font-medium">
                    <Utensils className="w-3.5 h-3.5 text-[#15803D]" />
                    Meal Eligible (Central Dining Access)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editCurfew"
                    checked={editingStudent.curfewExempt}
                    onChange={(e) => setEditingStudent({ ...editingStudent, curfewExempt: e.target.checked })}
                    className="rounded border-gray-300 text-[#15803D] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="editCurfew" className="text-gray-700 cursor-pointer flex items-center gap-1.5 font-medium">
                    <Moon className="w-3.5 h-3.5 text-[#15803D]" />
                    Curfew Exemption (24/7 Research Passage)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white font-semibold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Print Single ID Card */}
      {printCardStudent && (
        <StudentIdCardPrint
          student={printCardStudent}
          onClose={() => setPrintCardStudent(null)}
        />
      )}

      {/* MODAL 5: Print A4 Batch Selected / Filtered ID Cards */}
      {showA4PrintModal && (
        <StudentIdCardsA4PrintModal
          students={
            selectedStudentIds.size > 0
              ? students.filter((s) => selectedStudentIds.has(s.id))
              : filteredStudents
          }
          onClose={() => setShowA4PrintModal(false)}
        />
      )}
    </div>
  );
};
