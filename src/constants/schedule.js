// src/constants/schedule.js

const DEFAULT_WEEKLY_HOURS = [
  { day: "mon", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "tue", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "wed", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "thu", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "fri", enabled: true, slots: [{ start: "09:00", end: "18:00" }] },
  { day: "sat", enabled: true, slots: [{ start: "10:00", end: "15:00" }] },
  { day: "sun", enabled: false, slots: [] },
];

const DEFAULT_TIMEZONE = "Europe/Kyiv";
const DEFAULT_SLOT_MODE = "fixed";
const DEFAULT_SLOT_STEP_MIN = 30;

export {
  DEFAULT_WEEKLY_HOURS,
  DEFAULT_TIMEZONE,
  DEFAULT_SLOT_MODE,
  DEFAULT_SLOT_STEP_MIN,
};
