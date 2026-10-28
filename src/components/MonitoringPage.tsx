import React, { useState } from 'react';
import { Student, GateScanLog, GateLane, MealLog } from '../types/gate';
import { OccupancyDashboard } from './OccupancyDashboard';
import { GateAuditLogs } from './GateAuditLogs';
import { Users, History, Activity } from 'lucide-react';

interface MonitoringPageProps {
  students: Student[];
  logs: GateScanLog[];
  gates: GateLane[];
  mealLogs?: MealLog[];
  summaryOnly?: boolean;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = ({
  students,
  logs,
  gates,
  mealLogs = [],
  summaryOnly = false,
}) => {
  // If summaryOnly is true, lock to 'occupancy' view with summary cards only
  const [activeTab, setActiveTab] = useState<'occupancy' | 'audit'>('occupancy');

  return (
    <div className="space-y-6">
      {/* Monitoring Tab Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#15803D]" />
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              {summaryOnly ? 'Perimeter Security Dashboard' : 'Campus Security Monitoring & Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            {summaryOnly
              ? 'Guard summary metrics: real-time verified on-campus headcount, ingress/egress totals, and gate status.'
              : 'Real-time on-campus density tracking, gate velocity, and immutable credential access ledger.'}
          </p>
        </div>

        {/* Tab switcher: Only shown for SUPER_ADMIN (not in summaryOnly mode) */}
        {!summaryOnly && (
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('occupancy')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                activeTab === 'occupancy'
                  ? 'bg-[#15803D] text-white border-[#15803D] shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Live Occupancy</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
                activeTab === 'audit'
                  ? 'bg-[#15803D] text-white border-[#15803D] shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Access Audit</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Live Occupancy / Headcount */}
      {(summaryOnly || activeTab === 'occupancy') && (
        <OccupancyDashboard
          students={students}
          logs={logs}
          gates={gates}
          mealLogs={mealLogs}
          summaryOnly={summaryOnly}
        />
      )}

      {/* Tab 2: Access Audit (SUPER_ADMIN only) */}
      {!summaryOnly && activeTab === 'audit' && (
        <GateAuditLogs
          logs={logs}
          gates={gates}
          mealLogs={mealLogs}
        />
      )}
    </div>
  );
};
