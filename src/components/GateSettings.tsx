import React, { useState } from 'react';
import { SystemSettings, GateLane } from '../types/gate';
import { 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Clock, 
  RotateCcw,
  ShieldAlert,
  Moon,
  DoorClosed,
  Sliders,
  Plus,
  Trash2,
  Utensils,
  Save,
  Check
} from 'lucide-react';

interface GateSettingsProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  gates: GateLane[];
  onAddGate: (gate: Omit<GateLane, 'id' | 'totalEntriesToday' | 'totalExitsToday'>) => void;
  onUpdateGate: (id: string, updates: Partial<GateLane>) => void;
  onDeleteGate: (id: string) => void;
  onResetDemoData: () => void;
  activeSection?: SettingsSection;
  onSectionChange?: (section: SettingsSection) => void;
}

export type SettingsSection = 'policies' | 'scan_points' | 'meal_periods';

export const GateSettings: React.FC<GateSettingsProps> = ({
  settings,
  onUpdateSettings,
  gates,
  onAddGate,
  onUpdateGate,
  onDeleteGate,
  onResetDemoData,
  activeSection: propActiveSection,
  onSectionChange,
}) => {
  // Settings Section Dropdown State
  const [internalSection, setInternalSection] = useState<SettingsSection>('policies');
  const activeSection = propActiveSection || internalSection;

  const handleSectionSelect = (sec: SettingsSection) => {
    setInternalSection(sec);
    if (onSectionChange) {
      onSectionChange(sec);
    }
  };

  // Modal / Form states for Add Gate
  const [isAddGateOpen, setIsAddGateOpen] = useState(false);
  const [newGateName, setNewGateName] = useState('');
  const [newGateCode, setNewGateCode] = useState('');
  const [newGateLocation, setNewGateLocation] = useState('');
  const [newGateType, setNewGateType] = useState<GateLane['type']>('speed_gate');
  const [newGateDirection, setNewGateDirection] = useState<GateLane['allowedDirection']>('ENTRY');

  // Meal Periods Configuration State
  const defaultMealPeriods = {
    Breakfast: { start: '07:00', end: '10:30' },
    Lunch: { start: '11:30', end: '14:30' },
    Dinner: { start: '17:30', end: '21:00' },
  };

  const [mealPeriodsForm, setMealPeriodsForm] = useState(
    settings.mealPeriods || defaultMealPeriods
  );
  const [mealPeriodsToast, setMealPeriodsToast] = useState(false);

  // Sync state if settings prop updates from Firestore
  React.useEffect(() => {
    if (settings.mealPeriods) {
      setMealPeriodsForm(settings.mealPeriods);
    }
  }, [settings.mealPeriods]);

  const handleUpdateMealPeriod = (
    period: 'Breakfast' | 'Lunch' | 'Dinner',
    field: 'start' | 'end',
    val: string
  ) => {
    setMealPeriodsForm((prev) => ({
      ...prev,
      [period]: {
        ...prev[period],
        [field]: val,
      },
    }));
  };

  const handleSaveMealPeriods = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ mealPeriods: mealPeriodsForm });
    setMealPeriodsToast(true);
    setTimeout(() => setMealPeriodsToast(false), 2500);
  };

  const handleCreateGate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGateName.trim() || !newGateCode.trim()) return;
    onAddGate({
      name: newGateName.trim(),
      code: newGateCode.trim().toUpperCase(),
      location: newGateLocation.trim() || 'Campus Perimeter',
      type: newGateType,
      allowedDirection: newGateDirection,
      status: 'LOCKED',
    });
    setNewGateName('');
    setNewGateCode('');
    setNewGateLocation('');
    setIsAddGateOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Settings Section Dropdown Selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#15803D]" />
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              System Settings
            </h1>
          </div>
          <p className="text-xs text-gray-600 mt-0.5">
            SUPER_ADMIN console to configure Security Policies, Scan Points (Lane A, Lane B, Cafeteria), and Meal Periods.
          </p>
        </div>

        {/* Section Dropdown Menu */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="text-xs font-semibold text-gray-700 shrink-0">
            Select Section:
          </label>
          <select
            value={activeSection}
            onChange={(e) => handleSectionSelect(e.target.value as SettingsSection)}
            className="px-3.5 py-2 bg-white border border-gray-300 rounded-md text-xs font-bold text-gray-900 focus:outline-none focus:border-[#15803D] cursor-pointer shadow-2xs"
          >
            <option value="policies">Security Policies</option>
            <option value="scan_points">Scan Points (Lane A, Lane B, Cafeteria)</option>
            <option value="meal_periods">Meal Periods Schedule</option>
          </select>
        </div>
      </div>

      {/* SECTION 1: SECURITY POLICIES */}
      {activeSection === 'policies' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#15803D]" />
                <h2 className="text-base font-bold text-gray-900">Access Control Policies & Security Enforcement</h2>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Configure turnstile hardware response policies, security logic filters, and campus curfew restrictions.
              </p>
            </div>

            <div className="space-y-4 divide-y divide-gray-200">
              {/* Anti-Passback Toggle */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                    <span>Anti-Passback Security Enforcement</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                    Prevents badge-sharing fraud by requiring alternating ENTRY and EXIT scans. If an active credential tries to enter while already marked as inside campus, access is immediately blocked.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ antiPassback: !settings.antiPassback })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.antiPassback ? 'bg-[#15803D]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.antiPassback ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Night Curfew Rules */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-[#15803D]" />
                    <span>Campus Night Curfew Access Gate Filter</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                    Restricts perimeter entry between 22:00 PM and 06:00 AM to students holding authorized 24/7 research or medical exemptions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ curfewEnabled: !settings.curfewEnabled })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.curfewEnabled ? 'bg-[#15803D]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.curfewEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Gate Mechanical Relock Timer */}
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#15803D]" />
                    <span>Barrier Unlock Duration (Auto-Relock)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                    Time in seconds the speed gate or turnstile remains open after credential validation before the optical sensors seal the barrier.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="2"
                    max="8"
                    step="0.5"
                    value={settings.gateRelockSeconds}
                    onChange={(e) => onUpdateSettings({ gateRelockSeconds: parseFloat(e.target.value) })}
                    className="w-32 accent-[#15803D] cursor-pointer"
                  />
                  <span className="text-sm font-bold text-[#15803D] tabular-nums w-10 text-right">
                    {settings.gateRelockSeconds}s
                  </span>
                </div>
              </div>

              {/* Sound Synthesizer Audio Cues */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-[#15803D]" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    )}
                    <span>Acoustic Terminal Chimes & Audio Buzzers</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                    Synthesizes Web Audio oscillators for immediate audible approval chimes (784Hz) and denied triple-buzz alerts (180Hz) at the scan point.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.soundEnabled ? 'bg-[#15803D]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Emergency All-Gates Override */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#DC2626] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Emergency Egress Mode (Free Passage)</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 max-w-xl leading-relaxed">
                    Unlocks all turnstile barrier arms across every perimeter lane simultaneously for emergency evacuation or building fire alarms.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ emergencyEgressMode: !settings.emergencyEgressMode })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.emergencyEgressMode ? 'bg-[#DC2626]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.emergencyEgressMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* SYSTEM RESET & PURGE SECTION */}
          <div className="bg-white border border-red-200 rounded-lg p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-[#DC2626] flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>Reset Application & Re-seed Defaults</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 max-w-xl">
                Restores standard turnstiles, sample students, meal logs, and system policies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all demo state to standard initial values?')) {
                  onResetDemoData();
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-white hover:bg-red-50 text-[#DC2626] border border-red-300 font-semibold text-xs transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo State</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: SCAN POINTS (Lane A, Lane B, Cafeteria) */}
      {activeSection === 'scan_points' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <DoorClosed className="w-5 h-5 text-[#15803D]" />
                <h2 className="text-base font-bold text-gray-900">Perimeter Scan Points & Dining Lanes</h2>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Optical turnstiles, barriers, and cafeteria validation points (Lane A, Lane B, Cafeteria).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddGateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Scan Point</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gates.map((g) => {
              const isMeal = g.type === 'MEAL';
              return (
                <div key={g.id} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
                        {isMeal ? <Utensils className="w-4 h-4 text-[#15803D]" /> : <DoorClosed className="w-4 h-4 text-gray-700" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">{g.name}</h3>
                        <span className="text-[11px] text-gray-500">{g.location}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 font-mono font-bold">
                      {g.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-200">
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Lane Type</span>
                      <span className="font-bold text-gray-900 uppercase">{g.type.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Allowed Direction</span>
                      <span className="font-bold text-gray-900">{g.allowedDirection}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Entries Today</span>
                      <span className="font-bold text-[#15803D]">{g.totalEntriesToday}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Exits Today</span>
                      <span className="font-bold text-gray-700">{g.totalExitsToday}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs">
                    <button
                      type="button"
                      onClick={() => onUpdateGate(g.id, { status: g.status === 'LOCKED' ? 'UNLOCKED' : 'LOCKED' })}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                        g.status === 'UNLOCKED'
                          ? 'bg-green-50 border-green-200 text-[#15803D]'
                          : 'bg-gray-100 border-gray-300 text-gray-700'
                      }`}
                    >
                      {g.status}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete scan point ${g.name}?`)) {
                          onDeleteGate(g.id);
                        }
                      }}
                      className="p-1 rounded text-gray-400 hover:text-[#DC2626] transition-colors cursor-pointer"
                      title="Delete scan point"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: MEAL PERIODS SCHEDULE */}
      {activeSection === 'meal_periods' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#15803D]" />
                <h2 className="text-base font-bold text-gray-900">Cafeteria Dining Windows & Meal Schedule</h2>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                Configure serving time windows for Breakfast, Lunch, and Dinner. Students are limited to 1 meal per period today.
              </p>
            </div>

            {mealPeriodsToast && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-green-50 border border-green-200 text-[#15803D] text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                <span>Schedule Saved!</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveMealPeriods} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['Breakfast', 'Lunch', 'Dinner'] as const).map((period) => (
                <div key={period} className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-gray-900">{period}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 font-semibold">
                      1 Meal Limit / Student
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-gray-600 text-[11px] font-semibold mb-1">Start Time</label>
                      <input
                        type="time"
                        value={mealPeriodsForm[period].start}
                        onChange={(e) => handleUpdateMealPeriod(period, 'start', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-mono font-medium focus:outline-none focus:border-[#15803D]"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 text-[11px] font-semibold mb-1">End Time</label>
                      <input
                        type="time"
                        value={mealPeriodsForm[period].end}
                        onChange={(e) => handleUpdateMealPeriod(period, 'end', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-md text-gray-900 font-mono font-medium focus:outline-none focus:border-[#15803D]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Meal Schedules</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD GATE */}
      {isAddGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xl max-w-md w-full text-gray-900">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
              <h3 className="font-bold text-base text-gray-900">Provision New Scan Point</h3>
              <button type="button" onClick={() => setIsAddGateOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateGate} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">Gate Name *</label>
                <input
                  type="text"
                  required
                  value={newGateName}
                  onChange={(e) => setNewGateName(e.target.value)}
                  placeholder="e.g. Science Library Turnstile 2"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">Gate Code *</label>
                  <input
                    type="text"
                    required
                    value={newGateCode}
                    onChange={(e) => setNewGateCode(e.target.value)}
                    placeholder="e.g. GATE-04"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-semibold">Type</label>
                  <select
                    value={newGateType}
                    onChange={(e) => setNewGateType(e.target.value as GateLane['type'])}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                  >
                    <option value="speed_gate">Speed Gate (Optical)</option>
                    <option value="tripod">Tripod Turnstile</option>
                    <option value="MEAL">Dining Hall (Meal Station)</option>
                    <option value="full_height">Full Height Security Turnstile</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">Location</label>
                <input
                  type="text"
                  value={newGateLocation}
                  onChange={(e) => setNewGateLocation(e.target.value)}
                  placeholder="e.g. North Quad"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">Allowed Direction</label>
                <select
                  value={newGateDirection}
                  onChange={(e) => setNewGateDirection(e.target.value as GateLane['allowedDirection'])}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:border-[#15803D]"
                >
                  <option value="ENTRY">ENTRY (Inbound Only)</option>
                  <option value="EXIT">EXIT (Outbound Only)</option>
                  <option value="BIDIRECTIONAL">BIDIRECTIONAL (Both Directions)</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button type="button" onClick={() => setIsAddGateOpen(false)} className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md bg-[#15803D] hover:bg-[#166534] text-white font-semibold shadow-xs cursor-pointer">
                  Save Scan Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
