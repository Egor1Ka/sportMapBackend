const padTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  return `${hh}:${mm}`;
};

const toSlotDto = (duration) => (slot) => ({
  startMin: slot.startMin,
  startTime: padTime(slot.startMin),
  endTime: padTime(slot.startMin + duration),
  isExtra: slot.isExtra || false,
});

export { toSlotDto };
