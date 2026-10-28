import React, { useState, useMemo } from 'react';
import { Student, StudentStatus, StudentState } from '../types/gate';
import { BarcodeRenderer } from './BarcodeRenderer';
import { uploadStudentPhoto } from '../services/storageService';
import { 
  UserPlus, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Image as ImageIcon, 
  Loader2, 
  Printer, 
  RefreshCw, 
  Utensils, 
  Moon, 
  IdCard,
  Sparkles,
  ShieldCheck,
  Check,
  ArrowRight
} from 'lucide-react';

interface StudentRegistrationPageProps {
  students: Student[];
  onAddStudent: (newStudent: Student) => void | Promise<void>;
  onPrintCard?: (student: Student) => void;
  onViewDirectory?: () => void;
}

const DEPARTMENTS = [
  'Computer Science',
  'Biomedical Engineering',
  'Architecture & Design',
  'Robotics & AI',
  'Economics & Finance',
  'School of Medicine',
  'Applied Physics',
  'Faculty of Law',
  'Civil Engineering',
  'Electrical Engineering',
  'Business Administration',
  'Environmental Science'
];

const ACADEMIC_LEVELS = [
  'Year 1 (Freshman)',
  'Year 2 (Sophomore)',
  'Year 3 (Junior)',
  'Year 4 (Senior)',
  'Postgraduate / Masters',
  'PhD Candidate'
];

export const StudentRegistrationPage: React.FC<StudentRegistrationPageProps> = ({
  students,
  onAddStudent,
  onPrintCard,
  onViewDirectory,
}) => {
  // Form State
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [level, setLevel] = useState('Year 1 (Freshman)');
  const [status, setStatus] = useState<StudentStatus>('ACTIVE');
  const [currentState, setCurrentState] = useState<StudentState>('OUT');
  const [mealEligible, setMealEligible] = useState(true);
  const [curfewExempt, setCurfewExempt] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+1 (555) 019-4820');

  // UI state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredSuccessStudent, setRegisteredSuccessStudent] = useState<Student | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Check for duplicate ID in existing students
  const isDuplicateId = useMemo(() => {
    if (!studentId.trim()) return false;
    const clean = studentId.trim().toUpperCase();
    return students.some((s) => s.id.toUpperCase() === clean);
  }, [studentId, students]);

  // Existing student matched if duplicate
  const existingStudent = useMemo(() => {
    if (!isDuplicateId) return null;
    return students.find((s) => s.id.toUpperCase() === studentId.trim().toUpperCase());
  }, [isDuplicateId, studentId, students]);

  // Auto-generate suggested ID
  const handleGenerateSampleId = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generated = `RU${randomNum}/16-0`;
    setStudentId(generated);
    setFeedbackError(null);
  };

  // Auto-fill suggested email based on full name
  const handleNameChange = (name: string) => {
    setFullName(name);
    if (!email || email.includes('@campus.edu')) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
      setEmail(slug ? `${slug}@campus.edu` : '');
    }
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tempId = studentId.trim().toUpperCase() || `STU_${Date.now()}`;
    setIsUploadingPhoto(true);
    setFeedbackError(null);

    try {
      const url = await uploadStudentPhoto(tempId, file);
      setPhotoUrl(url);
    } catch (err) {
      console.error('Photo upload error:', err);
      setFeedbackError('Failed to upload photo. Using default color avatar.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Reset form
  const handleResetForm = () => {
    setStudentId('');
    setFullName('');
    setDepartment('Computer Science');
    setLevel('Year 1 (Freshman)');
    setStatus('ACTIVE');
    setCurrentState('OUT');
    setMealEligible(true);
    setCurfewExempt(false);
    setPhotoUrl('');
    setEmail('');
    setPhone('+1 (555) 019-4820');
    setFeedbackError(null);
  };

  // Submit Registration
  const handleSubmit = async (e: React.FormEvent, andPrintCard = false) => {
    e.preventDefault();
    setFeedbackError(null);

    const cleanId = studentId.trim().toUpperCase();
    const cleanName = fullName.trim();

    if (!cleanId) {
      setFeedbackError('Student ID is required (e.g. RU0073/16-0).');
      return;
    }

    if (!cleanName) {
      setFeedbackError('Student Full Name is required.');
      return;
    }

    if (isDuplicateId) {
      setFeedbackError(`Student ID "${cleanId}" is already registered to ${existingStudent?.fullName}. Please use a unique ID.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const avatarColors = ['#15803D', '#1E40AF', '#B45309', '#475569', '#047857'];
      const defaultColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

      const newStudent: Student = {
        id: cleanId,
        fullName: cleanName,
        department,
        level,
        status,
        currentState,
        mealEligible,
        curfewExempt,
        photo: photoUrl || defaultColor,
        email: email.trim() || `${cleanId.toLowerCase()}@campus.edu`,
        phone: phone.trim() || '+1 (555) 019-4820',
      };

      await onAddStudent(newStudent);
      setRegisteredSuccessStudent(newStudent);

      if (andPrintCard && onPrintCard) {
        onPrintCard(newStudent);
      }

      handleResetForm();
    } catch (err: any) {
      console.error('Registration error:', err);
      setFeedbackError(err.message || 'Failed to enroll student into Firestore database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initials for avatar
  const initials = useMemo(() => {
    if (!fullName.trim()) return 'ST';
    return fullName
      .trim()
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [fullName]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-green-50 border border-green-200 text-[#15803D] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                Student Credential Registration & Enrollment
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Enroll new students, generate Code 128 barcodes, set meal plan privileges, and print physical ID cards.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onViewDirectory && (
            <button
              type="button"
              onClick={onViewDirectory}
              className="px-3.5 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>View Enrolled Directory ({students.length})</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner with Registered Card Confirmation */}
      {registeredSuccessStudent && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#15803D] text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-[#15803D]">
                Student Enrolled Successfully: {registeredSuccessStudent.fullName}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                ID: <span className="font-mono font-bold text-gray-900">{registeredSuccessStudent.id}</span> · {registeredSuccessStudent.department} · {registeredSuccessStudent.mealEligible ? 'Meal Eligible' : 'No Meal Plan'} · {registeredSuccessStudent.curfewExempt ? '24/7 Access' : 'Standard Curfew'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPrintCard && (
              <button
                type="button"
                onClick={() => onPrintCard(registeredSuccessStudent)}
                className="px-3 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print ID Card</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRegisteredSuccessStudent(null)}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {feedbackError && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-[#DC2626] text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{feedbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackError(null)}
            className="text-red-700 hover:text-red-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Form on Left / Live Card Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Clean Registration Form (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-lg p-5 sm:p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <IdCard className="w-4 h-4 text-[#15803D]" />
              <span>Student Profile Information</span>
            </h3>
            <span className="text-[11px] text-gray-500">* Required fields</span>
          </div>

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4 text-xs">
            {/* Photo Upload Section */}
            <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                {photoUrl ? (
                  <img src={photoUrl} alt="Student Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">No photo</span>
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="font-bold text-gray-900 text-xs">Student Portrait Photo</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Upload official student photo for campus turnstile identity cards and guard verification terminal.
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-xs font-semibold shadow-2xs cursor-pointer transition-colors">
                    {isUploadingPhoto ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#15803D]" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>Select Photo</span>
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

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs text-[#DC2626] hover:underline px-2 py-1"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 1: Student ID (with duplicate checker & auto-generator) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-gray-800 flex items-center gap-1.5">
                  <span>Student ID (Barcode & Primary Key) *</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateSampleId}
                  className="text-[11px] text-[#15803D] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate ID</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value.toUpperCase());
                    setFeedbackError(null);
                  }}
                  placeholder="e.g. RU0073/16-0"
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-xs font-mono font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors ${
                    isDuplicateId
                      ? 'border-[#DC2626] focus:border-[#DC2626] bg-red-50/20'
                      : studentId.trim()
                      ? 'border-green-500 focus:border-[#15803D]'
                      : 'border-gray-300 focus:border-[#15803D]'
                  }`}
                />
                {studentId.trim() && !isDuplicateId && (
                  <CheckCircle2 className="w-4 h-4 text-[#15803D] absolute right-3 top-1/2 -translate-y-1/2" />
                )}
                {isDuplicateId && (
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>

              {isDuplicateId ? (
                <div className="text-[11px] text-[#DC2626] font-semibold mt-1 flex items-center gap-1">
                  <span>⚠️ ID already registered to {existingStudent?.fullName} ({existingStudent?.department})</span>
                </div>
              ) : (
                <div className="text-[11px] text-gray-500 mt-1">
                  Unique student identifier encoded into turnstile Code 128 barcode badges.
                </div>
              )}
            </div>

            {/* Row 2: Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Alexandre Mercer"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Campus Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alexandre.mercer@campus.edu"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>
            </div>

            {/* Row 3: Department & Academic Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Department / Faculty
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Academic Level / Year
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  {ACADEMIC_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Status & Current Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StudentStatus)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="ACTIVE">ACTIVE (Authorized for turnstile entry)</option>
                  <option value="SUSPENDED">SUSPENDED (Access blocked at all gates)</option>
                  <option value="EXPIRED">EXPIRED (Registration pending renewal)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Current Campus Presence
                </label>
                <select
                  value={currentState}
                  onChange={(e) => setCurrentState(e.target.value as StudentState)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-xs font-medium text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="OUT">OUT (Off-site / Expected to Enter)</option>
                  <option value="IN">IN (Already on campus grounds)</option>
                </select>
              </div>
            </div>

            {/* Privileges: Meal Plan & Curfew Toggles */}
            <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
              <div className="font-bold text-gray-900 text-xs uppercase tracking-wider">
                Access Privileges & Subscriptions
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Meal Eligibility */}
                <label className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  mealEligible ? 'bg-green-50/60 border-green-300' : 'bg-white border-gray-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={mealEligible}
                    onChange={(e) => setMealEligible(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-[#15803D] focus:ring-[#15803D] cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>Meal Plan Active</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Enrolls student in dining hall cafeteria service with meal card tracking.
                    </div>
                  </div>
                </label>

                {/* Curfew Exemption */}
                <label className={`p-3 rounded-md border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  curfewExempt ? 'bg-green-50/60 border-green-300' : 'bg-white border-gray-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={curfewExempt}
                    onChange={(e) => setCurfewExempt(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-[#15803D] focus:ring-[#15803D] cursor-pointer"
                  />
                  <div>
                    <div className="font-bold text-gray-900 flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>Curfew Exempt (24/7)</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Permits round-the-clock late-night egress and ingress without lockdown denial.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto px-4 py-2 rounded-md bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Form</span>
              </button>

              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || isDuplicateId || !studentId.trim() || !fullName.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-md bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Student...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Register Student</span>
                    </>
                  )}
                </button>

                {onPrintCard && (
                  <button
                    type="button"
                    disabled={isSubmitting || isDuplicateId || !studentId.trim() || !fullName.trim()}
                    onClick={(e) => handleSubmit(e, true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-md bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    title="Register student and immediately open printable physical card"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Register & Print Card</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live CR80 Student Identity Card Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#15803D]" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Live ID Card Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                ISO/IEC 7810 ID-1
              </span>
            </div>

            {/* CR80 Badge (85.6mm x 54mm Aspect Ratio) */}
            <div className="relative w-full aspect-[85.6/54] rounded-xl overflow-hidden bg-white border border-gray-300 shadow-md flex flex-col justify-between p-3.5 select-none transition-all">
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#15803D] text-white flex items-center justify-center font-black text-xs shadow-xs">
                    CG
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-900 uppercase tracking-wider leading-none">
                      CAMPUS GATEWAY
                    </div>
                    <div className="text-[8px] text-gray-500 font-semibold tracking-wide">
                      STUDENT IDENTITY ACCESS CARD
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    status === 'ACTIVE'
                      ? 'bg-green-100 text-[#15803D]'
                      : 'bg-red-100 text-[#DC2626]'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Card Body: Photo + Name + Dept */}
              <div className="flex items-center gap-3 py-1">
                {/* Portrait */}
                <div className="w-14 h-18 rounded-md border border-gray-300 overflow-hidden bg-gray-100 shrink-0 shadow-2xs flex items-center justify-center">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#15803D] text-white flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-gray-900 truncate">
                    {fullName.trim() || 'Alexandre Mercer'}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-[#15803D] truncate mt-0.5">
                    {studentId.trim().toUpperCase() || 'RU0073/16-0'}
                  </div>
                  <div className="text-[9px] text-gray-600 truncate mt-0.5">
                    {department}
                  </div>
                  <div className="text-[8px] text-gray-400 truncate">
                    {level}
                  </div>

                  {/* Micro Chips */}
                  <div className="flex items-center gap-1 mt-1">
                    {mealEligible && (
                      <span className="text-[8px] px-1 py-0.2 rounded bg-green-50 text-[#15803D] font-bold border border-green-200">
                        MEAL
                      </span>
                    )}
                    {curfewExempt && (
                      <span className="text-[8px] px-1 py-0.2 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        24/7
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Code 128 Barcode */}
              <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between">
                <div className="flex-1 bg-white p-0.5 rounded flex justify-start">
                  <BarcodeRenderer
                    value={studentId.trim().toUpperCase() || 'RU0073/16-0'}
                    height={16}
                    moduleWidth={1.0}
                    showText={false}
                    lightBackground={false}
                  />
                </div>
                <span className="text-[7px] text-gray-400 font-mono text-right shrink-0 ml-2">
                  SEC-CR80 · TURNSTILE
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-md p-3 border border-gray-200 text-[11px] text-gray-600 space-y-1.5">
              <div className="font-bold text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Integrated System Capabilities</span>
              </div>
              <p className="text-[10px] text-gray-500">
                Registering this student provisions immediate turnstile passage eligibility across Lane A & B and connects their record with cafeteria meal entitlement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
