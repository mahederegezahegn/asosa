import React, { useState, useMemo } from 'react';
import { Student, GateScanLog, GateLane, MealLog } from '../types/gate';
import { 
  Users, 
  UserCheck, 
  ShieldAlert, 
  TrendingUp, 
  Download, 
  Building2, 
  Clock, 
  Printer, 
  CheckCircle2, 
  Search,
  ArrowRightCircle,
  ArrowLeftCircle,
  AlertTriangle,
  BarChart3,
  Utensils,
  XCircle,
  Calendar,
  Filter,
  RotateCcw,
  Check,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  Activity
} from 'lucide-react';

interface OccupancyDashboardProps {
  students: Student[];
  logs: GateScanLog[];
  gates: GateLane[];
  mealLogs?: MealLog[];
  summaryOnly?: boolean;
}

export type MovementPreset = 'all' | 'inside' | 'exited_today' | 'not_exited_yet' | 'outside';

export const OccupancyDashboard: React.FC<OccupancyDashboardProps> = ({
  students,
  logs,
  gates,
  mealLogs = [],
  summaryOnly = false,
}) => {
  // Movements Table Filters
  const [movementSearch, setMovementSearch] = useState('');
  const [movementPreset, setMovementPreset] = useState<MovementPreset>('all');
  const [movementLaneFilter, setMovementLaneFilter] = useState('all');
  const [movementDateFilter, setMovementDateFilter] = useState('');

  // Emergency Roll Call Filters
  const [rollCallSearch, setRollCallSearch] = useState('');
  const [rollCallDeptFilter, setRollCallDeptFilter] = useState('all');

  // Today Date YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Today's Gate Scans
  const todayGateLogs = useMemo(() => {
    return logs.filter((l) => (l.timestamp ? l.timestamp.slice(0, 10) === todayStr : true));
  }, [logs, todayStr]);

  // Today's Meal Scans
  const todayMealLogs = useMemo(() => {
    return mealLogs.filter((m) => {
      const dStr = m.date || (m.timestamp ? m.timestamp.slice(0, 10) : '');
      return dStr === todayStr;
    });
  }, [mealLogs, todayStr]);

  // Filter students currently IN (on campus)
  const insideStudents = useMemo(() => {
    const latestMovementMap = new Map<string, { direction: 'ENTRY' | 'EXIT'; timestamp: string; gateName: string }>();
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    sortedLogs.forEach((l) => {
      if ((l.result === 'ALLOWED' || l.result === 'GRANTED') && l.studentId) {
        latestMovementMap.set(l.studentId, {
          direction: l.direction,
          timestamp: l.timestamp,
          gateName: l.gateName || 'Main Gate',
        });
      }
    });

    return students.filter((s) => {
      const fromLogs = latestMovementMap.get(s.id);
      if (fromLogs) {
        return fromLogs.direction === 'ENTRY';
      }
      return s.currentState === 'IN';
    });
  }, [students, logs]);

  // SUMMARY CARD CALCULATIONS
  const campusCapacity = 2500;
  const currentHeadcount = insideStudents.length;
  const totalStudents = students.length;
  const offCampusCount = Math.max(0, totalStudents - currentHeadcount);
  const occupancyPercentage = Math.min(100, Math.round((currentHeadcount / campusCapacity) * 100));

  // Total Entries Today
  const totalEntriesToday = useMemo(() => {
    return todayGateLogs.filter((l) => l.direction === 'ENTRY' && (l.result === 'ALLOWED' || l.result === 'GRANTED')).length;
  }, [todayGateLogs]);

  // Total Exits Today
  const totalExitsToday = useMemo(() => {
    return todayGateLogs.filter((l) => l.direction === 'EXIT' && (l.result === 'ALLOWED' || l.result === 'GRANTED')).length;
  }, [todayGateLogs]);

  // Total Warnings Today (Passback warnings, meal duplicates, etc.)
  const totalWarningsToday = useMemo(() => {
    const gateWarnings = todayGateLogs.filter((l) => l.result === 'WARNING' || l.result === 'DENIED_PASSBACK').length;
    const mealWarnings = todayMealLogs.filter((m) => m.status === 'WARNING').length;
    return gateWarnings + mealWarnings;
  }, [todayGateLogs, todayMealLogs]);

  // Total Denied Scans Today
  const totalDeniedToday = useMemo(() => {
    const gateDenied = todayGateLogs.filter((l) => l.result.startsWith('DENIED')).length;
    const mealDenied = todayMealLogs.filter((m) => m.status === 'DENIED').length;
    return gateDenied + mealDenied;
  }, [todayGateLogs, todayMealLogs]);

  // Meals Served Today Per Period
  const todayMealsPerPeriod = useMemo(() => {
    const granted = todayMealLogs.filter((m) => m.status === 'GRANTED');
    const breakfast = granted.filter((m) => m.mealType === 'Breakfast').length;
    const lunch = granted.filter((m) => m.mealType === 'Lunch').length;
    const dinner = granted.filter((m) => m.mealType === 'Dinner').length;
    return {
      breakfast,
      lunch,
      dinner,
      total: granted.length,
    };
  }, [todayMealLogs]);

  // Department distribution for students currently IN
  const deptDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    insideStudents.forEach((s) => {
      map[s.department] = (map[s.department] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [insideStudents]);

  // Unique departments
  const departments = useMemo(() => {
    const set = new Set(students.map((s) => s.department));
    return Array.from(set).sort();
  }, [students]);

  // Unique Lanes
  const uniqueLanes = useMemo(() => {
    const set = new Set(gates.map((g) => g.name));
    return Array.from(set).sort();
  }, [gates]);

  // Entries Per Hour Data
  const hourlyEntriesData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      displayLabel: `${String(i).padStart(2, '0')}h`,
      count: 0,
    }));

    const baselineDistribution: Record<number, number> = {
      6: 4,
      7: 18,
      8: 45,
      9: 38,
      10: 22,
      11: 15,
      12: 29,
      13: 20,
      14: 17,
      15: 14,
      16: 12,
      17: 8,
      18: 5,
    };

    Object.entries(baselineDistribution).forEach(([h, count]) => {
      const idx = Number(h);
      if (hours[idx]) hours[idx].count += count;
    });

    logs.forEach((log) => {
      if (log.direction === 'ENTRY' && (log.result === 'ALLOWED' || log.result === 'GRANTED')) {
        try {
          const logDate = new Date(log.timestamp);
          if (!isNaN(logDate.getTime())) {
            const h = logDate.getHours();
            if (hours[h]) hours[h].count += 1;
          }
        } catch {}
      }
    });

    const maxCount = Math.max(...hours.map((h) => h.count), 1);
    const peakHour = hours.reduce((prev, cur) => (cur.count > prev.count ? cur : prev), hours[8]);

    return { hours, maxCount, peakHour };
  }, [logs]);

  // STUDENT MOVEMENTS MAP & CALCULATIONS
  const studentMovements = useMemo(() => {
    const targetDate = movementDateFilter || todayStr;
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const movementsMap = new Map<string, {
      lastScanTime: string;
      lastLane: string;
      lastDirection: 'ENTRY' | 'EXIT';
      hasEnteredToday: boolean;
      hasExitedToday: boolean;
    }>();

    sortedLogs.forEach((l) => {
      if ((l.result === 'ALLOWED' || l.result === 'GRANTED') && l.studentId) {
        const logDate = l.timestamp.slice(0, 10);
        const isTargetDate = logDate === targetDate;

        const existing = movementsMap.get(l.studentId) || {
          lastScanTime: l.timestamp,
          lastLane: l.gateName || 'Main Gate',
          lastDirection: l.direction,
          hasEnteredToday: false,
          hasExitedToday: false,
        };

        existing.lastScanTime = l.timestamp;
        existing.lastLane = l.gateName || 'Main Gate';
        existing.lastDirection = l.direction;

        if (isTargetDate) {
          if (l.direction === 'ENTRY') existing.hasEnteredToday = true;
          if (l.direction === 'EXIT') existing.hasExitedToday = true;
        }

        movementsMap.set(l.studentId, existing);
      }
    });

    return students.map((s) => {
      const mov = movementsMap.get(s.id);
      return {
        student: s,
        currentPresence: s.currentState,
        lastScanTime: mov?.lastScanTime || s.lastMovement?.timestamp || 'No movement recorded',
        lastLane: mov?.lastLane || s.lastMovement?.gateName || 'Lane A',
        lastDirection: mov?.lastDirection || s.lastMovement?.direction || 'ENTRY',
        hasEnteredToday: mov?.hasEnteredToday || false,
        hasExitedToday: mov?.hasExitedToday || false,
      };
    });
  }, [students, logs, todayStr, movementDateFilter]);

  // FILTERED STUDENT MOVEMENTS
  const filteredMovements = useMemo(() => {
    const q = movementSearch.toLowerCase().trim();

    return studentMovements.filter((m) => {
      const stu = m.student;

      // 1. Search Query
      const matchesSearch =
        stu.id.toLowerCase().includes(q) ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.department.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      // 2. Movement Preset Filter
      if (movementPreset === 'inside') {
        if (m.currentPresence !== 'IN') return false;
      } else if (movementPreset === 'exited_today') {
        if (!m.hasExitedToday) return false;
      } else if (movementPreset === 'not_exited_yet') {
        if (!m.hasEnteredToday || m.hasExitedToday) return false;
      } else if (movementPreset === 'outside') {
        if (m.currentPresence !== 'OUT') return false;
      }

      // 3. Lane Filter
      if (movementLaneFilter !== 'all') {
        if (m.lastLane !== movementLaneFilter) return false;
      }

      // 4. Date Filter
      if (movementDateFilter) {
        if (!m.lastScanTime.startsWith(movementDateFilter)) return false;
      }

      return true;
    });
  }, [studentMovements, movementSearch, movementPreset, movementLaneFilter, movementDateFilter]);

  // Export Movements CSV
  const handleExportMovementsCSV = () => {
    const headers = [
      'Student ID',
      'Full Name',
      'Department',
      'Level',
      'Presence',
      'Last Scan Time',
      'Last Lane',
      'Last Direction',
    ];

    const rows = filteredMovements.map((m) => [
      `"${m.student.id}"`,
      `"${m.student.fullName}"`,
      `"${m.student.department}"`,
      `"${m.student.level}"`,
      `"${m.currentPresence}"`,
      `"${m.lastScanTime}"`,
      `"${m.lastLane}"`,
      `"${m.lastDirection}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Movements_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Movements
  const handlePrintMovements = () => {
    window.print();
  };

  // Filtered Emergency Roll Call List
  const filteredRollCall = useMemo(() => {
    const q = rollCallSearch.toLowerCase().trim();
    return insideStudents.filter((stu) => {
      const matchesSearch =
        stu.id.toLowerCase().includes(q) ||
        stu.fullName.toLowerCase().includes(q) ||
        stu.department.toLowerCase().includes(q);

      const matchesDept = rollCallDeptFilter === 'all' || stu.department === rollCallDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [insideStudents, rollCallSearch, rollCallDeptFilter]);

  // Export Emergency Roll Call CSV
  const handleExportRollCallCSV = () => {
    const headers = [
      'Student ID',
      'Full Name',
      'Department',
      'Level',
      'Check-In Timestamp',
      'Entry Gate',
      'Meal Plan',
      'Curfew Exempt',
      'Presence'
    ];

    const rows = insideStudents.map((s) => [
      `"${s.id}"`,
      `"${s.fullName}"`,
      `"${s.department}"`,
      `"${s.level}"`,
      `"${s.lastMovement?.timestamp || new Date().toISOString()}"`,
      `"${s.lastMovement?.gateName || 'Main Gate'}"`,
      s.mealEligible ? 'YES' : 'NO',
      s.curfewExempt ? 'YES' : 'NO',
      s.currentState,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `emergency_muster_roll_call_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Emergency Roll Call
  const handlePrintRollCall = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: Summary Cards (Inside Now, Entries Today, Exits Today, Warnings, Denied, Meals Served) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Inside Now */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Inside Now</span>
            <Users className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-gray-900">{currentHeadcount}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {occupancyPercentage}% of {campusCapacity} capacity
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#15803D] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(occupancyPercentage, 4)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Entries Today */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Entries Today</span>
            <UserCheck className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-[#15803D]">{totalEntriesToday}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Verified inbound passages</div>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <ArrowRightCircle className="w-3 h-3 text-[#15803D]" />
            <span>Turnstiles active</span>
          </div>
        </div>

        {/* Card 3: Exits Today */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Exits Today</span>
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-gray-900">{totalExitsToday}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Off campus: {offCampusCount}</div>
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1">
            <ArrowLeftCircle className="w-3 h-3 text-gray-600" />
            <span>Outbound passages</span>
          </div>
        </div>

        {/* Card 4: Warnings Today */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Warnings Today</span>
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-[#DC2626]">{totalWarningsToday}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Passback & meal duplicates</div>
          </div>
          <div className="text-[10px] text-[#DC2626] font-semibold">
            {totalWarningsToday === 0 ? 'No alerts recorded' : 'Requires security review'}
          </div>
        </div>

        {/* Card 5: Denied Scans */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Denied Scans</span>
            <XCircle className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-[#DC2626]">{totalDeniedToday}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Blocked or unknown cards</div>
          </div>
          <div className="text-[10px] text-gray-500">
            Perimeter security enforced
          </div>
        </div>

        {/* Card 6: Meals Served Today Per Period */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 uppercase">
            <span>Meals Served</span>
            <Utensils className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="my-1">
            <div className="text-2xl font-black text-[#15803D]">
              {todayMealsPerPeriod.total}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-green-50 border border-green-200 text-[#15803D]">
                B: {todayMealsPerPeriod.breakfast}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-green-50 border border-green-200 text-[#15803D]">
                L: {todayMealsPerPeriod.lunch}
              </span>
              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-green-50 border border-green-200 text-[#15803D]">
                D: {todayMealsPerPeriod.dinner}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500">
            Today's dining redemptions
          </div>
        </div>
      </div>

      {/* GUARD VIEW summary notice */}
      {summaryOnly && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-gray-900">Perimeter Guard Headcount Summary</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Real-time campus population and turnstile transit counts. Access <strong>Scan Terminal</strong> in the sidebar to scan credentials.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded border border-gray-200 bg-gray-50 text-gray-700 self-start sm:self-auto">
            Guard Mode
          </span>
        </div>
      )}

      {!summaryOnly && (
        <>
          {/* SECTION 2: Entries Per Hour Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#15803D]" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                    Entries Per Hour (Ingress Traffic Flow)
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Hourly entry volume across all perimeter turnstiles and gates.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2.5 py-1 rounded bg-green-50 border border-green-200 text-[#15803D] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Peak: {hourlyEntriesData.peakHour.label} ({hourlyEntriesData.peakHour.count} entries)
                </span>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="pt-2 pb-2 overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="h-44 flex items-end gap-1.5 sm:gap-2 px-2 border-b border-gray-200 pb-2">
                  {hourlyEntriesData.hours
                    .filter((h) => h.hour >= 6 && h.hour <= 22)
                    .map((item) => {
                      const barHeightPct = Math.round((item.count / hourlyEntriesData.maxCount) * 100);
                      const isPeak = item.hour === hourlyEntriesData.peakHour.hour;

                      return (
                        <div key={item.hour} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                          <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-900">
                            {item.count > 0 ? item.count : ''}
                          </span>
                          <div className="w-full bg-gray-100 rounded-t overflow-hidden h-28 flex items-end">
                            <div
                              className={`w-full rounded-t transition-all duration-200 ${
                                isPeak ? 'bg-[#15803D]' : 'bg-[#15803D]/70 group-hover:bg-[#15803D]'
                              }`}
                              style={{ height: `${Math.max(barHeightPct, 6)}%` }}
                            />
                          </div>
                          <span className={`text-xs mt-1 ${isPeak ? 'font-bold text-[#15803D]' : 'text-gray-500'}`}>
                            {item.displayLabel}
                          </span>
                        </div>
                      );
                    })}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-3 px-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D]/70" />
                      Standard Traffic
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D]" />
                      Peak Transit Hour
                    </span>
                  </div>
                  <span>Sampling: 06:00 - 22:00</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Distribution by Department & Scan Point Volumes */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Scan Point Volumes */}
            <div className="lg:col-span-7 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-700" />
                    <span>Entries & Exits Today Per Scan Point</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Transit volume breakdown across turnstiles and dining scan points.
                  </p>
                </div>
                <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
                  {gates.length} Lanes
                </span>
              </div>

              <div className="space-y-2">
                {gates.map((g) => {
                  const entries = g.totalEntriesToday || 0;
                  const exits = g.totalExitsToday || 0;
                  const total = entries + exits;
                  const isMeal = g.type === 'MEAL';

                  return (
                    <div
                      key={g.id}
                      className="p-3 rounded-md bg-white border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{g.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 font-mono">
                            {g.code}
                          </span>
                          {isMeal && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-[#15803D] border border-green-200 flex items-center gap-1 font-medium">
                              <Utensils className="w-3 h-3" />
                              Dining Point
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span>{g.location}</span>
                          <span>·</span>
                          <span className="uppercase">{g.type.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>{g.allowedDirection}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-gray-900">{total} scans</div>
                        <div className="text-xs text-gray-600 flex items-center gap-2 mt-0.5">
                          <span className="text-[#15803D] font-medium">↓ In: {entries}</span>
                          <span className="text-gray-300">|</span>
                          <span>↑ Out: {exits}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Distribution by Department */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-700" />
                    <span>Distribution by Department</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Breakdown of students currently inside campus perimeter.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#15803D]">
                  {currentHeadcount} Present
                </span>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {deptDistribution.length === 0 ? (
                  <div className="text-xs text-gray-500 py-8 text-center">
                    Zero students currently logged inside campus.
                  </div>
                ) : (
                  deptDistribution.map(([dept, count]) => {
                    const pct = currentHeadcount > 0 ? Math.round((count / currentHeadcount) * 100) : 0;
                    return (
                      <div key={dept} className="p-3 rounded-md bg-gray-50 border border-gray-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-800 font-semibold">{dept}</span>
                          <span className="text-gray-700 font-medium">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#15803D] h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: FULL STUDENT MOVEMENTS TABLE WITH ALL 5 FILTERS */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#15803D]" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <span>Full Student Movements Manifest</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-50 text-[#15803D] border border-green-200">
                      {filteredMovements.length} Records
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Complete tracking roster showing presence, last scan time, last lane, and direction for every student.
                </p>
              </div>

              {/* Action Buttons: CSV Export & Print */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintMovements}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Table</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMovementsCSV}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Movement Presets & Toolbar Filters */}
            <div className="space-y-3">
              {/* Preset Buttons: All, Inside now, Exited today, Not exited yet, Outside */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-600 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter Presets:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setMovementPreset('all')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                    movementPreset === 'all'
                      ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  All ({students.length})
                </button>

                <button
                  type="button"
                  onClick={() => setMovementPreset('inside')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                    movementPreset === 'inside'
                      ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  Inside Now ({insideStudents.length})
                </button>

                <button
                  type="button"
                  onClick={() => setMovementPreset('exited_today')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                    movementPreset === 'exited_today'
                      ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  Exited Today ({studentMovements.filter((m) => m.hasExitedToday).length})
                </button>

                <button
                  type="button"
                  onClick={() => setMovementPreset('not_exited_yet')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                    movementPreset === 'not_exited_yet'
                      ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  Not Exited Yet ({studentMovements.filter((m) => m.hasEnteredToday && !m.hasExitedToday).length})
                </button>

                <button
                  type="button"
                  onClick={() => setMovementPreset('outside')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                    movementPreset === 'outside'
                      ? 'bg-[#15803D] text-white border-[#15803D] shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  Outside ({offCampusCount})
                </button>
              </div>

              {/* Secondary Filter Controls: Student Search, By Lane, By Date */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    placeholder="Search by ID, name, or department..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D]"
                  />
                </div>

                {/* By Lane */}
                <select
                  value={movementLaneFilter}
                  onChange={(e) => setMovementLaneFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="all">All Lanes ({uniqueLanes.length})</option>
                  {uniqueLanes.map((lane) => (
                    <option key={lane} value={lane}>{lane}</option>
                  ))}
                </select>

                {/* By Date */}
                <div className="relative w-full sm:w-auto">
                  <input
                    type="date"
                    value={movementDateFilter}
                    onChange={(e) => setMovementDateFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
                  />
                </div>

                {(movementSearch || movementLaneFilter !== 'all' || movementDateFilter || movementPreset !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMovementSearch('');
                      setMovementPreset('all');
                      setMovementLaneFilter('all');
                      setMovementDateFilter('');
                    }}
                    className="text-xs text-[#15803D] hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Movements Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Movements Table */}
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Presence</th>
                    <th className="py-2.5 px-3">Last Scan Time</th>
                    <th className="py-2.5 px-3">Last Lane</th>
                    <th className="py-2.5 px-3 text-right">Last Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No student movement records match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const isPhotoUrl = m.student.photo && (m.student.photo.startsWith('http') || m.student.photo.startsWith('data:image'));
                      const isInside = m.currentPresence === 'IN';

                      return (
                        <tr key={m.student.id} className="hover:bg-gray-50 transition-colors">
                          {/* Student Name & Photo */}
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            <div className="flex items-center gap-2">
                              {isPhotoUrl ? (
                                <img
                                  src={m.student.photo}
                                  alt={m.student.fullName}
                                  className="w-7 h-7 rounded object-cover border border-gray-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-[#15803D] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                  {m.student.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <span>{m.student.fullName}</span>
                            </div>
                          </td>

                          {/* Student ID */}
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-800">
                            <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded">
                              {m.student.id}
                            </span>
                          </td>

                          {/* Department */}
                          <td className="py-2.5 px-3 text-gray-700">
                            {m.student.department} ({m.student.level})
                          </td>

                          {/* Presence Badge */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isInside
                                  ? 'bg-green-50 border-green-200 text-[#15803D]'
                                  : 'bg-gray-100 border-gray-300 text-gray-600'
                              }`}
                            >
                              {isInside ? 'IN (ON CAMPUS)' : 'OUT (OFF CAMPUS)'}
                            </span>
                          </td>

                          {/* Last Scan Time */}
                          <td className="py-2.5 px-3 text-gray-600">
                            {m.lastScanTime.includes('T') || m.lastScanTime.includes('-')
                              ? new Date(m.lastScanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                                ` (${new Date(m.lastScanTime).toLocaleDateString()})`
                              : m.lastScanTime}
                          </td>

                          {/* Last Lane */}
                          <td className="py-2.5 px-3 text-gray-700 font-medium">
                            {m.lastLane}
                          </td>

                          {/* Last Direction */}
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                m.lastDirection === 'ENTRY'
                                  ? 'bg-green-50 border-green-200 text-[#15803D]'
                                  : 'bg-gray-100 border-gray-300 text-gray-700'
                              }`}
                            >
                              {m.lastDirection}
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

          {/* SECTION 5: Emergency Roll Call (Muster Manifest) */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <span>Emergency Roll Call (Live Muster Manifest)</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-50 text-[#DC2626] border border-red-200">
                      {insideStudents.length} Students IN
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Evacuation muster roster listing all personnel verified inside campus perimeter for response operations.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrintRollCall}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Muster</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportRollCallCSV}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Strip inside Emergency Roll Call */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rollCallSearch}
                  onChange={(e) => setRollCallSearch(e.target.value)}
                  placeholder="Search by ID, name, or dept..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D]"
                />
              </div>

              <select
                value={rollCallDeptFilter}
                onChange={(e) => setRollCallDeptFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-700 focus:outline-none focus:border-[#15803D]"
              >
                <option value="all">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Roll Call Table */}
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Student ID</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Department & Level</th>
                    <th className="py-2.5 px-3">Check-In Time</th>
                    <th className="py-2.5 px-3">Entry Gate</th>
                    <th className="py-2.5 px-3">Privileges</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {filteredRollCall.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">
                        No students currently logged as IN match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRollCall.map((stu) => {
                      const checkInTime = stu.lastMovement?.timestamp
                        ? new Date(stu.lastMovement.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Earlier Today';

                      return (
                        <tr key={stu.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{stu.id}</td>
                          <td className="py-2.5 px-3 font-medium text-gray-900">{stu.fullName}</td>
                          <td className="py-2.5 px-3 text-gray-800">{stu.department} ({stu.level})</td>
                          <td className="py-2.5 px-3 text-gray-600">{checkInTime}</td>
                          <td className="py-2.5 px-3 text-gray-600">{stu.lastMovement?.gateName || 'Main Gate'}</td>
                          <td className="py-2.5 px-3 text-xs text-gray-600">
                            {stu.mealEligible && <span className="px-1.5 py-0.5 bg-gray-100 rounded border mr-1">Meal</span>}
                            {stu.curfewExempt && <span className="px-1.5 py-0.5 bg-gray-100 rounded border">24/7</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#15803D] font-bold">IN</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
