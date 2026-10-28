import React, { useState, useMemo } from 'react';
import { GateScanLog, GateLane, MealLog, MealPeriodName } from '../types/gate';
import { 
  History, 
  Search, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  Calendar,
  Filter,
  Utensils,
  ShieldCheck,
  Coffee,
  Sun,
  Moon,
  Users,
  Building,
  RotateCcw
} from 'lucide-react';

interface GateAuditLogsProps {
  logs: GateScanLog[];
  gates: GateLane[];
  mealLogs?: MealLog[];
}

export const GateAuditLogs: React.FC<GateAuditLogsProps> = ({
  logs,
  gates,
  mealLogs = [],
}) => {
  // Main view toggle: 'gates' (Perimeter Scans) | 'meals' (Meals Section: Meals Served Per Period Per Day)
  const [logViewType, setLogViewType] = useState<'gates' | 'meals'>('gates');

  // Filters
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [gateFilter, setGateFilter] = useState<string>('all'); // scanPointId
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [mealPeriodFilter, setMealPeriodFilter] = useState<string>('all');

  // Today string YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // 1. FILTERED GATE PERIMETER SCAN LOGS
  const filteredGateLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date filter
      if (dateFilter) {
        const logDateStr = log.timestamp.slice(0, 10);
        if (logDateStr !== dateFilter) return false;
      }

      // Scan Point filter
      if (gateFilter !== 'all' && log.gateId !== gateFilter) {
        return false;
      }

      // Direction filter
      if (directionFilter !== 'all' && log.direction !== directionFilter) {
        return false;
      }

      // Result filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ALLOWED') {
          if (log.result !== 'ALLOWED' && log.result !== 'GRANTED') return false;
        } else if (statusFilter === 'WARNING') {
          if (log.result !== 'WARNING' && log.result !== 'DENIED_PASSBACK') return false;
        } else if (statusFilter === 'DENIED') {
          if (!log.result.startsWith('DENIED')) return false;
        } else if (log.result !== statusFilter) {
          return false;
        }
      }

      // Student filter (name, studentId, barcode, department)
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        const matchName = log.studentName?.toLowerCase().includes(q);
        const matchId = (log.studentId || log.studentNumber || '').toLowerCase().includes(q);
        const matchBarcode = log.barcode?.toLowerCase().includes(q);
        const matchDept = log.department?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchBarcode && !matchDept) return false;
      }

      return true;
    });
  }, [logs, dateFilter, gateFilter, directionFilter, statusFilter, studentSearch]);

  // 2. MEALS SECTION: MEALS SERVED PER PERIOD PER DAY AGGREGATION
  const mealsDailyMatrix = useMemo(() => {
    // Map of date -> { date, Breakfast: count, Lunch: count, Dinner: count, Total: count, Warning: count, Denied: count, students: Set }
    const matrixMap: Record<
      string,
      {
        date: string;
        Breakfast: number;
        Lunch: number;
        Dinner: number;
        TotalServed: number;
        Warnings: number;
        Denied: number;
        students: Set<string>;
      }
    > = {};

    mealLogs.forEach((ml) => {
      const dStr = ml.date || (ml.timestamp ? ml.timestamp.slice(0, 10) : todayStr);
      if (!matrixMap[dStr]) {
        matrixMap[dStr] = {
          date: dStr,
          Breakfast: 0,
          Lunch: 0,
          Dinner: 0,
          TotalServed: 0,
          Warnings: 0,
          Denied: 0,
          students: new Set<string>(),
        };
      }

      const rec = matrixMap[dStr];
      if (ml.status === 'GRANTED') {
        rec.TotalServed += 1;
        if (ml.mealType === 'Breakfast') rec.Breakfast += 1;
        else if (ml.mealType === 'Lunch') rec.Lunch += 1;
        else if (ml.mealType === 'Dinner') rec.Dinner += 1;
        if (ml.studentId) rec.students.add(ml.studentId);
      } else if (ml.status === 'WARNING') {
        rec.Warnings += 1;
      } else if (ml.status === 'DENIED') {
        rec.Denied += 1;
      }
    });

    return Object.values(matrixMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [mealLogs, todayStr]);

  // Totals for today's meals
  const todayMealsSummary = useMemo(() => {
    const todayRec = mealsDailyMatrix.find((m) => m.date === todayStr);
    return {
      breakfast: todayRec?.Breakfast || 0,
      lunch: todayRec?.Lunch || 0,
      dinner: todayRec?.Dinner || 0,
      total: todayRec?.TotalServed || 0,
      uniqueStudents: todayRec?.students.size || 0,
      alreadyServedWarnings: todayRec?.Warnings || 0,
    };
  }, [mealsDailyMatrix, todayStr]);

  // 3. FILTERED INDIVIDUAL MEAL LOGS
  const filteredMealLogs = useMemo(() => {
    return mealLogs.filter((ml) => {
      // Date filter
      if (dateFilter) {
        const dStr = ml.date || (ml.timestamp ? ml.timestamp.slice(0, 10) : '');
        if (dStr !== dateFilter) return false;
      }

      // Meal Period filter
      if (mealPeriodFilter !== 'all' && ml.mealType !== mealPeriodFilter) {
        return false;
      }

      // Scan Point filter
      if (gateFilter !== 'all' && ml.scanPointId && ml.scanPointId !== gateFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ALLOWED' && ml.status !== 'GRANTED') return false;
        if (statusFilter === 'WARNING' && ml.status !== 'WARNING') return false;
        if (statusFilter === 'DENIED' && ml.status !== 'DENIED') return false;
      }

      // Student filter
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase().trim();
        const matchName = ml.studentName?.toLowerCase().includes(q);
        const matchId = ml.studentId?.toLowerCase().includes(q);
        const matchBarcode = ml.barcode?.toLowerCase().includes(q);
        const matchDept = ml.department?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchBarcode && !matchDept) return false;
      }

      return true;
    });
  }, [mealLogs, dateFilter, mealPeriodFilter, gateFilter, statusFilter, studentSearch]);

  // CSV Export for Gate Logs
  const handleExportGatesCSV = () => {
    const headers = [
      'Timestamp',
      'Student Name',
      'Student ID',
      'Barcode',
      'Department',
      'Scan Point Gate',
      'Direction',
      'Result',
      'Message',
      'Details Reason',
      'Operator ID'
    ];

    const rows = filteredGateLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.studentName}"`,
      `"${l.studentId || l.studentNumber || 'N/A'}"`,
      `"${l.barcode}"`,
      `"${l.department || 'N/A'}"`,
      `"${l.gateName}"`,
      l.direction,
      l.result,
      `"${l.message}"`,
      `"${l.details || ''}"`,
      `"${l.operatorId || 'system'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `access_audit_gates_${dateFilter || 'all_dates'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Meals Logs & Daily Period Matrix
  const handleExportMealsCSV = () => {
    const summaryHeaders = ['Date', 'Breakfast Served', 'Lunch Served', 'Dinner Served', 'Total Meals Served', 'Unique Students', 'Already Served Warnings'];
    const summaryRows = mealsDailyMatrix.map((m) => [
      `"${m.date}"`,
      m.Breakfast,
      m.Lunch,
      m.Dinner,
      m.TotalServed,
      m.students.size,
      m.Warnings,
    ]);

    const detailHeaders = ['Timestamp', 'Date', 'Meal Period', 'Student Name', 'Student ID', 'Department', 'Status', 'Reason', 'Scan Point'];
    const detailRows = filteredMealLogs.map((m) => [
      `"${m.timestamp}"`,
      `"${m.date || m.timestamp.slice(0, 10)}"`,
      `"${m.mealType}"`,
      `"${m.studentName || 'Unknown'}"`,
      `"${m.studentId || 'N/A'}"`,
      `"${m.department || 'N/A'}"`,
      `"${m.status}"`,
      `"${m.reason}"`,
      `"${m.scanPointName || 'Cafeteria'}"`,
    ]);

    const fullContent = [
      '# CAFETERIA MEALS AUDIT SUMMARY (MEALS SERVED PER PERIOD PER DAY)',
      summaryHeaders.join(','),
      ...summaryRows.map((r) => r.join(',')),
      '',
      '# INDIVIDUAL STUDENT MEAL AUDIT LOGS',
      detailHeaders.join(','),
      ...detailRows.map((r) => r.join(',')),
    ].join('\n');

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + fullContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `cafeteria_meals_audit_${dateFilter || 'all_dates'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setDateFilter('');
    setGateFilter('all');
    setStatusFilter('all');
    setStudentSearch('');
    setDirectionFilter('all');
    setMealPeriodFilter('all');
  };

  const renderStatusBadge = (result: GateScanLog['result']) => {
    if (result === 'ALLOWED' || result === 'GRANTED') {
      return (
        <span className="inline-flex items-center gap-1 text-[#15803D] font-medium text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>ALLOWED</span>
        </span>
      );
    }
    if (result === 'WARNING' || result === 'DENIED_PASSBACK') {
      return (
        <span className="inline-flex items-center gap-1 text-[#DC2626] font-medium text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>WARNING (PASSBACK)</span>
        </span>
      );
    }
    const label = result.replace('DENIED_', '');
    return (
      <span className="inline-flex items-center gap-1 text-[#DC2626] font-medium text-xs">
        <XCircle className="w-3.5 h-3.5" />
        <span>DENIED: {label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* SECTION 1: Top Navigation Strip (Perimeter Scans vs Meals Section) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Toggle between Perimeter Access Audit and Meals Section */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLogViewType('gates')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              logViewType === 'gates'
                ? 'bg-[#15803D] text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Perimeter Access Scans ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setLogViewType('meals')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              logViewType === 'meals'
                ? 'bg-[#15803D] text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Meals Served Per Period Per Day ({mealLogs.length})</span>
          </button>
        </div>

        {/* Global CSV Export Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={logViewType === 'gates' ? handleExportGatesCSV : handleExportMealsCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export {logViewType === 'gates' ? 'Scans CSV' : 'Meals CSV'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: Universal Comprehensive Filter Strip (Date, Scan Point, Result, Student) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <Filter className="w-4 h-4 text-gray-500" />
            <span>Audit Query Filters</span>
          </div>

          {(dateFilter || gateFilter !== 'all' || statusFilter !== 'all' || studentSearch || directionFilter !== 'all' || mealPeriodFilter !== 'all') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-xs text-[#15803D] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          {/* 1. Filter by Date */}
          <div className="space-y-1">
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>Filter by Date</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 text-xs focus:outline-none focus:border-[#15803D]"
              />
              <button
                type="button"
                onClick={() => setDateFilter(todayStr)}
                className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                  dateFilter === todayStr
                    ? 'bg-green-50 border-green-200 text-[#15803D]'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Select Today's Date"
              >
                Today
              </button>
            </div>
          </div>

          {/* 2. Filter by Scan Point */}
          <div className="space-y-1">
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-gray-500" />
              <span>Filter by Scan Point</span>
            </label>
            <select
              value={gateFilter}
              onChange={(e) => setGateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 text-xs focus:outline-none focus:border-[#15803D]"
            >
              <option value="all">All Scan Points</option>
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Result */}
          <div className="space-y-1">
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
              <span>Filter by Result</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 text-xs focus:outline-none focus:border-[#15803D]"
            >
              <option value="all">All Results</option>
              <option value="ALLOWED">ALLOWED / GRANTED</option>
              <option value="WARNING">WARNING (Passback / Already Served)</option>
              <option value="DENIED">ALL DENIED</option>
              <option value="DENIED_UNREGISTERED">Denied: Not Registered</option>
              <option value="DENIED_SUSPENDED">Denied: Suspended</option>
              <option value="DENIED_EXPIRED">Denied: Expired</option>
              <option value="DENIED_CURFEW">Denied: Curfew</option>
            </select>
          </div>

          {/* 4. Filter by Student (Search) */}
          <div className="space-y-1">
            <label className="text-xs text-gray-600 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <span>Filter by Student</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Name, ID, barcode..."
                className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 text-xs placeholder:text-gray-400 focus:outline-none focus:border-[#15803D]"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 5. Mode-Specific Filter: Direction (for Gates) OR Meal Period (for Meals) */}
          {logViewType === 'gates' ? (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span>Filter Direction</span>
              </label>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 text-xs focus:outline-none focus:border-[#15803D]"
              >
                <option value="all">All Directions</option>
                <option value="ENTRY">ENTRY (Inbound)</option>
                <option value="EXIT">EXIT (Outbound)</option>
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs text-gray-600 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-gray-500" />
                <span>Filter Meal Period</span>
              </label>
              <select
                value={mealPeriodFilter}
                onChange={(e) => setMealPeriodFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 text-xs focus:outline-none focus:border-[#15803D]"
              >
                <option value="all">All Periods</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3A: PERIMETER SCANS VIEW                          */}
      {/* ========================================================= */}
      {logViewType === 'gates' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" />
              <h3 className="text-sm font-bold text-gray-900">
                Perimeter Access Scan Records ({filteredGateLogs.length} matching)
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              Total Logged: {logs.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Timestamp & Date</th>
                  <th className="py-2.5 px-3">Student & ID</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Scan Point Lane</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Access Result</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {filteredGateLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No perimeter scan logs match the current query criteria.
                    </td>
                  </tr>
                ) : (
                  filteredGateLogs.map((log) => {
                    const logDate = new Date(log.timestamp);
                    const timeFormatted = !isNaN(logDate.getTime())
                      ? logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : log.timestamp;
                    const dateFormatted = !isNaN(logDate.getTime())
                      ? logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        {/* Timestamp */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-gray-900">{timeFormatted}</div>
                          <div className="text-[11px] text-gray-500">{dateFormatted}</div>
                        </td>

                        {/* Student Name & ID */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-gray-900">{log.studentName}</div>
                          <div className="text-xs text-gray-500">
                            {log.studentId || log.barcode}
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-2.5 px-3 text-gray-700">
                          {log.department || '—'}
                        </td>

                        {/* Gate Lane */}
                        <td className="py-2.5 px-3 text-gray-800">
                          <div className="font-medium">{log.gateName}</div>
                          <div className="text-xs text-gray-500">{log.gateId}</div>
                        </td>

                        {/* Direction */}
                        <td className="py-2.5 px-3">
                          {log.direction === 'ENTRY' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[#15803D] font-medium">
                              <ArrowRight className="w-3.5 h-3.5" />
                              ENTRY
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 font-medium">
                              <ArrowLeft className="w-3.5 h-3.5" />
                              EXIT
                            </span>
                          )}
                        </td>

                        {/* Result Badge */}
                        <td className="py-2.5 px-3">
                          {renderStatusBadge(log.result)}
                        </td>

                        {/* Ledger Details */}
                        <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate" title={log.details || log.message}>
                          <div className="font-medium text-gray-900">{log.message}</div>
                          {log.details && (
                            <div className="text-xs text-gray-500 truncate">{log.details}</div>
                          )}
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

      {/* ========================================================= */}
      {/* SECTION 3B: MEALS SECTION: MEALS SERVED PER PERIOD PER DAY */}
      {/* ========================================================= */}
      {logViewType === 'meals' && (
        <div className="space-y-6">
          {/* Top Cards: Today's Meals Served by Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Breakfast Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-gray-600" />
                  <span>Breakfast Today</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {todayMealsSummary.breakfast}
                </div>
                <div className="text-xs text-gray-500 mt-1">Window: 07:00 - 10:30</div>
              </div>
              <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 flex items-center justify-center">
                <Coffee className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Lunch Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-gray-600" />
                  <span>Lunch Today</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {todayMealsSummary.lunch}
                </div>
                <div className="text-xs text-gray-500 mt-1">Window: 11:30 - 14:30</div>
              </div>
              <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 flex items-center justify-center">
                <Sun className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Dinner Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-gray-600" />
                  <span>Dinner Today</span>
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {todayMealsSummary.dinner}
                </div>
                <div className="text-xs text-gray-500 mt-1">Window: 17:30 - 21:00</div>
              </div>
              <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 flex items-center justify-center">
                <Moon className="w-4 h-4 text-gray-600" />
              </div>
            </div>

            {/* Total Today Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-[#15803D]" />
                  <span>Total Meals Today</span>
                </div>
                <div className="text-2xl font-bold text-[#15803D] mt-2">
                  {todayMealsSummary.total}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Unique students: {todayMealsSummary.uniqueStudents}
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-green-50 border border-green-200 flex items-center justify-center">
                <Utensils className="w-4 h-4 text-[#15803D]" />
              </div>
            </div>
          </div>

          {/* Meals Served Per Period Per Day: Aggregated Daily Matrix */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#15803D]" />
                  <span>Meals Served Per Period Per Day (Daily Summary Matrix)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Consolidated dining service counts by date and period.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Breakfast</th>
                    <th className="py-2.5 px-3 text-center">Lunch</th>
                    <th className="py-2.5 px-3 text-center">Dinner</th>
                    <th className="py-2.5 px-3 text-center">Total Served</th>
                    <th className="py-2.5 px-3 text-center">Unique Students</th>
                    <th className="py-2.5 px-3 text-right">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {mealsDailyMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No meal logs recorded in system.
                      </td>
                    </tr>
                  ) : (
                    mealsDailyMatrix.map((row) => {
                      const isToday = row.date === todayStr;
                      return (
                        <tr
                          key={row.date}
                          className={`hover:bg-gray-50 transition-colors ${
                            isToday ? 'bg-green-50/30' : ''
                          }`}
                        >
                          {/* Date */}
                          <td className="py-2.5 px-3 font-semibold text-gray-900">
                            <div className="flex items-center gap-2">
                              <span>{row.date}</span>
                              {isToday && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-[#15803D] border border-green-200">
                                  TODAY
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Breakfast */}
                          <td className="py-2.5 px-3 text-center text-gray-800 font-medium">
                            {row.Breakfast}
                          </td>

                          {/* Lunch */}
                          <td className="py-2.5 px-3 text-center text-gray-800 font-medium">
                            {row.Lunch}
                          </td>

                          {/* Dinner */}
                          <td className="py-2.5 px-3 text-center text-gray-800 font-medium">
                            {row.Dinner}
                          </td>

                          {/* Total Served */}
                          <td className="py-2.5 px-3 text-center font-bold text-[#15803D]">
                            {row.TotalServed}
                          </td>

                          {/* Unique Students */}
                          <td className="py-2.5 px-3 text-center text-gray-700">
                            {row.students.size}
                          </td>

                          {/* Warnings (Duplicate Attempts) */}
                          <td className="py-2.5 px-3 text-right">
                            {row.Warnings > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[#DC2626] font-medium">
                                <AlertTriangle className="w-3 h-3" />
                                {row.Warnings} already served
                              </span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Cafeteria Meal Ledger Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#15803D]" />
                <h3 className="text-sm font-bold text-gray-900">
                  Individual Meal Records Ledger ({filteredMealLogs.length} matching)
                </h3>
              </div>
              <span className="text-xs text-gray-500">
                1 Meal Per Period Limit
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Timestamp & Date</th>
                    <th className="py-2.5 px-3">Student & ID</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Meal Period</th>
                    <th className="py-2.5 px-3">Serving Station</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredMealLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        No individual meal logs match the current query criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMealLogs.map((ml) => {
                      const logDate = new Date(ml.timestamp);
                      const timeStr = !isNaN(logDate.getTime())
                        ? logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : ml.timestamp;
                      const dateStr = ml.date || (!isNaN(logDate.getTime())
                        ? logDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                        : '');

                      return (
                        <tr key={ml.id} className="hover:bg-gray-50 transition-colors">
                          {/* Timestamp */}
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-gray-900">{timeStr}</div>
                            <div className="text-[11px] text-gray-500">{dateStr}</div>
                          </td>

                          {/* Student */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {ml.photo && (ml.photo.startsWith('http') || ml.photo.startsWith('data:image')) ? (
                                <img
                                  src={ml.photo}
                                  alt={ml.studentName || ''}
                                  className="w-6 h-6 rounded object-cover border border-gray-200"
                                />
                              ) : (
                                <div
                                  className="w-6 h-6 rounded flex items-center justify-center font-bold text-[9px] text-white bg-[#15803D]"
                                >
                                  {(ml.studentName || 'S').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900 block">
                                  {ml.studentName || 'Student'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {ml.studentId || ml.barcode}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-2.5 px-3 text-gray-700">
                            {ml.department || '—'}
                          </td>

                          {/* Meal Period */}
                          <td className="py-2.5 px-3 font-medium text-gray-800">
                            {ml.mealType}
                          </td>

                          {/* Scan Point */}
                          <td className="py-2.5 px-3 text-gray-700">
                            {ml.scanPointName || 'Cafeteria'}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3">
                            {ml.status === 'GRANTED' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                SERVED
                              </span>
                            ) : ml.status === 'WARNING' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626]">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                ALREADY SERVED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#DC2626]">
                                <XCircle className="w-3.5 h-3.5" />
                                DENIED
                              </span>
                            )}
                          </td>

                          {/* Reason */}
                          <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate" title={ml.reason}>
                            <span className={ml.status === 'WARNING' ? 'text-[#DC2626] font-medium' : 'text-gray-700'}>
                              {ml.reason}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
