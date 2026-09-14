// Shared low-memory / mobile detection. Phones get a lighter map:
// fewer world copies, smaller clouds, no satellite layer, no cylinder mode.
// (Each 11232x7525 decode is ~336MB — mobile Safari kills the tab first.)
export const IS_LOW_MEM =
  typeof navigator !== "undefined" &&
  ((typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4) ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "") ||
    (typeof screen !== "undefined" && Math.min(screen.width, screen.height) < 500));
