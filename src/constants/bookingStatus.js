const BOOKING_STATUS_ACTIONS = {
  HIDE_FROM_SCHEDULE: "hideFromSchedule",
};

const VALID_ACTIONS = Object.values(BOOKING_STATUS_ACTIONS);

const STATUS_COLORS = [
  "#8B5CF6",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#3B82F6",
  "#EC4899",
  "#F97316",
];

// Старые именованные цвета — оставлены для backward-совместимости с
// клиентами, у которых ещё не обновился фронт. Удалить через 2-4 недели
// после раскатки нового фронта (см. spec).
const LEGACY_NAMED_COLORS = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "gray",
  "teal",
];

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const isAllowedColor = (value) =>
  typeof value === "string" &&
  (HEX_COLOR_REGEX.test(value) || LEGACY_NAMED_COLORS.includes(value));

const DEFAULT_STATUSES = [
  {
    label: "status_unconfirmed",
    color: "#F59E0B",
    actions: [],
    isDefault: true,
    order: 0,
  },
  {
    label: "status_confirmed",
    color: "#3B82F6",
    actions: [],
    isDefault: true,
    order: 1,
  },
  {
    label: "status_paid",
    color: "#10B981",
    actions: [],
    isDefault: true,
    order: 2,
  },
  {
    label: "status_cancelled",
    color: "#EF4444",
    actions: [BOOKING_STATUS_ACTIONS.HIDE_FROM_SCHEDULE],
    isDefault: true,
    order: 3,
  },
];

export {
  BOOKING_STATUS_ACTIONS,
  DEFAULT_STATUSES,
  LEGACY_NAMED_COLORS,
  STATUS_COLORS,
  VALID_ACTIONS,
  isAllowedColor,
};
