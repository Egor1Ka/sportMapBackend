const MS_IN = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const parseUnit = (unit) => MS_IN[unit] || null;

export const parseDurationMs = (value, fallbackMs) => {
  if (!value) return fallbackMs;

  const match = String(value).match(/^(\d+)([smhd])$/);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = parseUnit(match[2]);

  if (!unit) return fallbackMs;

  return amount * unit;
};
