import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Clock,
  Save,
  AlertCircle,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Calendar,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import BathroomScaleIcon from "./icons/BathroomScaleIcon";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";

/**
 * Inline Date Picker
 */
const InlineDatePicker = ({ value, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(
    value ? new Date(value) : new Date(),
  );
  const [selectedDate, setSelectedDate] = useState(
    value ? new Date(value) : new Date(),
  );

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setCurrentMonth(date);
    }
  }, [value]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  const handleDateSelect = (day) => {
    setSelectedDate(day);
    onChange(format(day, "yyyy-MM-dd"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 w-full z-50 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden mt-2"
    >
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentMonth(subMonths(currentMonth, 1));
            }}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <h4 className="font-bold text-sm text-gray-900">
            {format(currentMonth, "MMMM yyyy")}
          </h4>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentMonth(addMonths(currentMonth, 1));
            }}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-bold text-gray-400 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDateSelect(day);
                }}
                className={`
                  aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all
                  ${
                    isSelected
                      ? "bg-green-600 text-white shadow-sm shadow-green-200"
                      : isCurrentMonth
                      ? "text-gray-900 hover:bg-gray-50"
                      : "text-gray-300"
                  }
                  ${
                    isTodayDate && !isSelected
                      ? "border border-green-200 text-green-600"
                      : ""
                  }
                `}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Inline Time Picker
 */
const InlineTimePicker = ({ value, onChange }) => {
  const hoursRef = useRef(null);
  const minutesRef = useRef(null);

  // Parse initial value "HH:MM"
  const parseTime = (timeStr) => {
    if (!timeStr) return { hours: 12, minutes: 0 };
    const [h, m] = timeStr.split(":").map(Number);
    return { hours: h, minutes: m };
  };

  const [selectedTime, setSelectedTime] = useState(parseTime(value));

  useEffect(() => {
    setSelectedTime(parseTime(value));
  }, [value]);

  // Scroll selected time into view on mount
  useEffect(() => {
    if (hoursRef.current) {
      const selectedHourBtn = hoursRef.current.querySelector(
        `[data-hour="${selectedTime.hours}"]`,
      );
      if (selectedHourBtn) {
        selectedHourBtn.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
    if (minutesRef.current) {
      const selectedMinuteBtn = minutesRef.current.querySelector(
        `[data-minute="${selectedTime.minutes}"]`,
      );
      if (selectedMinuteBtn) {
        selectedMinuteBtn.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }
    }
  }, []);

  const handleTimeChange = (type, val) => {
    const newTime = { ...selectedTime, [type]: val };
    setSelectedTime(newTime);
    const h = newTime.hours.toString().padStart(2, "0");
    const m = newTime.minutes.toString().padStart(2, "0");
    onChange(`${h}:${m}`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 5 minute steps

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-full left-0 w-full z-50 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden mt-2"
    >
      <div className="p-3">
        <div className="flex gap-2 h-40">
          {/* Hours Column */}
          <div
            ref={hoursRef}
            className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar"
          >
            <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10">
              HOURS
            </div>
            {hours.map((hour) => (
              <button
                key={hour}
                data-hour={hour}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimeChange("hours", hour);
                }}
                className={`
                  py-2 rounded-lg text-sm font-medium transition-all shrink-0
                  ${
                    selectedTime.hours === hour
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                {hour.toString().padStart(2, "0")}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px bg-gray-100 my-2"></div>

          {/* Minutes Column */}
          <div
            ref={minutesRef}
            className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar"
          >
            <div className="text-[10px] font-bold text-gray-400 text-center sticky top-0 bg-white py-1 z-10">
              MINS
            </div>
            {minutes.map((minute) => (
              <button
                key={minute}
                data-minute={minute}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimeChange("minutes", minute);
                }}
                className={`
                  py-2 rounded-lg text-sm font-medium transition-all shrink-0
                  ${
                    selectedTime.minutes === minute
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                {minute.toString().padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Time Window Settings Modal
 * Allows admins to configure activity time windows
 * UI: Mobile-first, clean, modern sheet/modal
 */
const TimeWindowSettingsModal = ({ isOpen, onClose, onUpdate, userEmail }) => {
  const [timeWindows, setTimeWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [lastUpdatedActivity, setLastUpdatedActivity] = useState(null);
  const [validationError, setValidationError] = useState(null);

  // Picker State
  const [activePicker, setActivePicker] = useState(null); // 'startTime', 'endTime', 'effectiveDate'

  const [formData, setFormData] = useState({
    windowStartTime: "",
    windowEndTime: "",
    changeReason: "",
  });

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Activity display configuration
  const getActivityConfig = (type) => {
    const configs = {
      weight: {
        name: "Weight",
        icon: BathroomScaleIcon,
        color: "text-purple-600",
        bg: "bg-purple-50",
        border: "border-purple-100",
      },
      education: {
        name: "Education",
        icon: BookOpen,
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-100",
      },
      breakfast: {
        name: "Breakfast",
        icon: Coffee,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-100",
      },
      lunch: {
        name: "Lunch",
        icon: Utensils,
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-100",
      },
      dinner: {
        name: "Dinner",
        icon: Moon,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        border: "border-indigo-100",
      },
    };
    return (
      configs[type] || {
        name: type,
        icon: Clock,
        color: "text-gray-600",
        bg: "bg-gray-50",
        border: "border-gray-100",
      }
    );
  };

  // Load time windows when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTimeWindows();
    }
  }, [isOpen]);

  async function loadTimeWindows(isBackground = false) {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiBaseUrl}/api/admin/time-windows`);
      setTimeWindows(response.data.timeWindows);
    } catch (err) {
      console.error("Error loading time windows:", err);
      setError("Failed to load time windows");
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  function handleEditWindow(window) {
    setSelectedActivity(window.ActivityType);
    setValidationError(null); // Clear any previous errors
    setFormData({
      windowStartTime: window.WindowStartTime.slice(0, 5), // HH:MM format
      windowEndTime: window.WindowEndTime.slice(0, 5),
      changeReason: "",
    });
  }

  function handleCancelEdit() {
    setSelectedActivity(null);
    setActivePicker(null);
    setValidationError(null); // Clear errors when canceling
    setFormData({
      windowStartTime: "",
      windowEndTime: "",
      changeReason: "",
    });
  }

  async function handleSaveChanges() {
    if (!selectedActivity) return;

    // Clear previous validation errors
    setValidationError(null);

    // Validation
    if (!formData.windowStartTime || !formData.windowEndTime) {
      setValidationError("Please enter both start and end times");
      return;
    }

    if (formData.windowStartTime >= formData.windowEndTime) {
      setValidationError("Start time must be before end time");
      return;
    }

    setSaving(true);
    setActivePicker(null);

    try {
      await axios.post(`${apiBaseUrl}/api/admin/time-windows`, {
        activityType: selectedActivity,
        windowStartTime: formData.windowStartTime,
        windowEndTime: formData.windowEndTime,
        // Use local date to prevent timezone shifting
        effectiveFromDate: (() => {
          const today = new Date();
          return (
            today.getFullYear() +
            "-" +
            String(today.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(today.getDate()).padStart(2, "0")
          );
        })(),
        changedBy: userEmail || "admin",
        changeReason: formData.changeReason,
      });

      // Immediately update local state so the new time shows right away
      const today = new Date();
      const todayStr =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

      setTimeWindows((prev) =>
        prev.map((tw) =>
          tw.ActivityType === selectedActivity
            ? {
                ...tw,
                WindowStartTime: formData.windowStartTime + ":00",
                WindowEndTime: formData.windowEndTime + ":00",
                LastUpdated: new Date().toISOString(),
                EffectiveFromDate: todayStr,
              }
            : tw,
        ),
      );

      // Also reload in background to sync with server
      loadTimeWindows(true);

      // Reset form
      handleCancelEdit();

      // Notify parent to refresh discipline report
      if (onUpdate) {
        onUpdate(true);
      }

      setSuccessMessage("Time window updated successfully!");
      setLastUpdatedActivity(selectedActivity);

      setTimeout(() => {
        setSuccessMessage(null);
        setLastUpdatedActivity(null);
      }, 4000);
    } catch (err) {
      console.error("Error saving time window:", err);
      const errorMessage =
        err.response?.data?.error || err.response?.data?.message || err.message;
      const errorDetails = err.response?.data?.details;

      if (errorDetails && typeof errorDetails === "object") {
        // Handle structured error (e.g., overlap error)
        setValidationError(
          `${errorMessage}: ${errorDetails.conflictsWith || ""} ${
            errorDetails.existingWindow || ""
          }`,
        );
      } else {
        setValidationError(`Failed to update: ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  }

  function formatTime(timeString) {
    if (!timeString) return "";
    const time = timeString.slice(0, 5); // HH:MM
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal Container - Bottom Sheet on Mobile, Centered on Desktop */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 pointer-events-none"
          >
            <div
              className="bg-white w-full sm:w-[500px] sm:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] pointer-events-auto overflow-hidden"
              onClick={(e) => {
                e.stopPropagation();
                setActivePicker(null);
              }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Time Windows
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure activity schedules
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Warning Banner - Minimal */}
              <div className="px-6 pt-4">
                <AnimatePresence mode="wait">
                  {successMessage ? (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-3 bg-green-100 border border-green-200 rounded-xl shadow-sm"
                    >
                      <div className="bg-green-200 p-1 rounded-full">
                        <Check className="h-3 w-3 text-green-700" />
                      </div>
                      <p className="text-xs text-green-800 font-medium leading-relaxed">
                        {successMessage}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-red-500 text-sm mb-3">{error}</p>
                    <button
                      onClick={loadTimeWindows}
                      className="text-green-600 text-sm font-medium hover:underline"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeWindows.map((window) => {
                      const config = getActivityConfig(window.ActivityType);
                      const isEditing =
                        selectedActivity === window.ActivityType;
                      const isJustUpdated =
                        lastUpdatedActivity === window.ActivityType;
                      const Icon = config.icon;

                      return (
                        <motion.div
                          key={window.ActivityType}
                          className={`rounded-2xl border transition-all ${
                            isEditing && activePicker
                              ? "overflow-visible z-20"
                              : "overflow-hidden"
                          } ${
                            isEditing
                              ? "bg-white border-green-200 shadow-lg ring-1 ring-green-100"
                              : isJustUpdated
                              ? "bg-green-50 border-green-200 shadow-sm"
                              : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                          }`}
                        >
                          {/* Card Header / Summary */}
                          <div className="p-4 flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bg} ${config.color}`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between pr-1">
                                <h3 className="font-bold text-gray-900 text-sm">
                                  {config.name}
                                </h3>
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {isEditing ? "Last updated: " : ""}
                                  {format(
                                    new Date(window.LastUpdated),
                                    "dd/MM/yyyy",
                                  )}
                                </span>
                              </div>
                              {!isEditing && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                    {formatTime(window.WindowStartTime)} -{" "}
                                    {formatTime(window.WindowEndTime)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {!isEditing && (
                              <button
                                onClick={() => handleEditWindow(window)}
                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Edit Form */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: "easeInOut",
                                }}
                                className={`border-t border-gray-50 bg-gray-50/30 px-4 pb-4 pt-2 rounded-b-2xl ${
                                  activePicker
                                    ? "overflow-visible"
                                    : "overflow-hidden"
                                }`}
                              >
                                <div className="space-y-4 mt-2">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        Start Time
                                      </label>
                                      <div
                                        className="relative group"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePicker(
                                            activePicker === "startTime"
                                              ? null
                                              : "startTime",
                                          );
                                        }}
                                      >
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-green-500 transition-colors pointer-events-none" />
                                        <div
                                          className={`w-full pl-10 pr-3 py-3 bg-white border ${
                                            activePicker === "startTime"
                                              ? "border-green-500 ring-1 ring-green-200"
                                              : "border-gray-200"
                                          } rounded-xl text-sm font-medium text-gray-900 hover:border-green-500 hover:ring-1 hover:ring-green-200 transition-all cursor-pointer flex items-center h-[46px]`}
                                        >
                                          {formData.windowStartTime || "Select"}
                                        </div>
                                        <AnimatePresence>
                                          {activePicker === "startTime" && (
                                            <InlineTimePicker
                                              value={formData.windowStartTime}
                                              onChange={(val) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  windowStartTime: val,
                                                }))
                                              }
                                            />
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        End Time
                                      </label>
                                      <div
                                        className="relative group"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePicker(
                                            activePicker === "endTime"
                                              ? null
                                              : "endTime",
                                          );
                                        }}
                                      >
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-hover:text-green-500 transition-colors pointer-events-none" />
                                        <div
                                          className={`w-full pl-10 pr-3 py-3 bg-white border ${
                                            activePicker === "endTime"
                                              ? "border-green-500 ring-1 ring-green-200"
                                              : "border-gray-200"
                                          } rounded-xl text-sm font-medium text-gray-900 hover:border-green-500 hover:ring-1 hover:ring-green-200 transition-all cursor-pointer flex items-center h-[46px]`}
                                        >
                                          {formData.windowEndTime || "Select"}
                                        </div>
                                        <AnimatePresence>
                                          {activePicker === "endTime" && (
                                            <InlineTimePicker
                                              value={formData.windowEndTime}
                                              onChange={(val) =>
                                                setFormData((prev) => ({
                                                  ...prev,
                                                  windowEndTime: val,
                                                }))
                                              }
                                            />
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                      Reason for Change
                                    </label>
                                    <textarea
                                      value={formData.changeReason}
                                      onChange={(e) =>
                                        setFormData({
                                          ...formData,
                                          changeReason: e.target.value,
                                        })
                                      }
                                      placeholder="Optional note..."
                                      rows={2}
                                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
                                    />
                                  </div>

                                  {/* Inline Validation Error */}
                                  <AnimatePresence>
                                    {validationError && (
                                      <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
                                      >
                                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                        <p className="text-xs text-red-700 font-medium leading-relaxed">
                                          {validationError}
                                        </p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      onClick={handleCancelEdit}
                                      disabled={saving}
                                      className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveChanges}
                                      disabled={saving}
                                      className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                                    >
                                      {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      ) : (
                                        <>
                                          <Save className="h-4 w-4" />
                                          Save Changes
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TimeWindowSettingsModal;
