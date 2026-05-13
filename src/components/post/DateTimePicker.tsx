"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (iso: string) => void;
  onClose: () => void;
  openUp?: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DateTimePicker({ value, onChange, onClose, openUp = false }: Props) {
  const now = new Date();
  const initial = value ? new Date(value) : null;

  const [viewYear, setViewYear] = useState(initial?.getFullYear() ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.getMonth() ?? now.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initial);
  const [hours, setHours] = useState(initial ? String(initial.getHours()).padStart(2, "0") : "12");
  const [minutes, setMinutes] = useState(initial ? String(initial.getMinutes()).padStart(2, "0") : "00");

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function isPast(day: number) {
    const d = new Date(viewYear, viewMonth, day, 23, 59, 59);
    return d < now;
  }
  function isSelected(day: number) {
    return !!selectedDate &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day;
  }
  function isToday(day: number) {
    return now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === day;
  }

  function clampHours(raw: string) {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return "00";
    return String(Math.min(23, Math.max(0, n))).padStart(2, "0");
  }
  function clampMinutes(raw: string) {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return "00";
    return String(Math.min(59, Math.max(0, n))).padStart(2, "0");
  }

  function handleConfirm() {
    if (!selectedDate) return;
    const d = new Date(selectedDate);
    d.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
    if (d <= now) return;
    onChange(d.toISOString());
    onClose();
  }

  return (
    <div
      className={cn(
        "bg-[var(--background)] border border-[var(--border)] shadow-2xl overflow-hidden z-50",
        "fixed inset-x-0 bottom-0 rounded-t-2xl",
        "md:absolute md:inset-x-auto md:w-72 md:rounded-2xl md:left-0 md:bottom-auto",
        openUp ? "md:bottom-full md:top-auto md:mb-2" : "md:top-full md:mt-2"
      )}
    >
      {/* Drag handle — mobile only */}
      <div className="flex justify-center pt-2.5 pb-0.5 md:hidden">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30" />
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-full hover:bg-[var(--hover)] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-bold text-sm">{MONTHS[viewMonth]} {viewYear}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-full hover:bg-[var(--hover)] transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-3">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--muted)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {cells.map((day, i) => (
          <div key={i} className="flex justify-center">
            {day !== null && (
              <button
                type="button"
                disabled={isPast(day)}
                onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day))}
                className={cn(
                  "w-9 h-9 rounded-full text-sm font-medium transition-colors",
                  isSelected(day)
                    ? "bg-[var(--accent)] text-white font-bold"
                    : isToday(day)
                    ? "border-2 border-[var(--accent)] text-[var(--accent)] font-bold"
                    : "hover:bg-[var(--hover)]",
                  isPast(day) && "opacity-30 cursor-not-allowed pointer-events-none"
                )}
              >
                {day}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Time picker */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border)]">
        <span className="text-sm text-[var(--muted)] font-medium flex-1">Time</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={(e) => setHours(clampHours(e.target.value))}
            className="w-11 text-center rounded-lg border border-[var(--border)] bg-[var(--hover)] py-1.5 text-sm font-bold outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="font-bold text-[var(--muted)] select-none">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onBlur={(e) => setMinutes(clampMinutes(e.target.value))}
            className="w-11 text-center rounded-lg border border-[var(--border)] bg-[var(--hover)] py-1.5 text-sm font-bold outline-none focus:border-[var(--accent)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
        {value ? (
          <button
            type="button"
            onClick={() => { onChange(""); onClose(); }}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!selectedDate}
          onClick={handleConfirm}
          className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-white text-sm font-bold disabled:opacity-40 transition-opacity"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
