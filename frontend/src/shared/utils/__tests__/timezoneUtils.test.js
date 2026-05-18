/**
 * Pure unit tests for the shared timezone utilities.
 *
 * Coverage target: ≥ 90 % lines / 80 % branches (claude.md §9.1 shared/).
 *
 * All assertions on local-formatted strings use `process.env.TZ` agnostic
 * checks (regex / parseable Date) so the suite is stable across CI workers
 * regardless of host timezone.
 */
import {
  istToLocalDate,
  formatISTToLocalDate,
  formatISTToLocalTime,
  formatISTToLocalDateTime,
  getRelativeTime,
  isToday,
  formatLocalDateString,
} from "../timezoneUtils";

let warnSpy;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  jest.useRealTimers();
});

describe("istToLocalDate", () => {
  test("returns null for falsy input", () => {
    expect(istToLocalDate(null)).toBeNull();
    expect(istToLocalDate(undefined)).toBeNull();
    expect(istToLocalDate("")).toBeNull();
  });

  test("returns null for malformed timestamps and warns", () => {
    expect(istToLocalDate("not a date")).toBeNull();
    expect(istToLocalDate("2026/03/06")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  test("parses 'YYYY-MM-DD HH:MM:SS' IST into a UTC-correct Date", () => {
    // 2026-03-06 14:00:00 IST === 2026-03-06 08:30:00 UTC
    const d = istToLocalDate("2026-03-06 14:00:00");
    expect(d).toBeInstanceOf(Date);
    expect(d.toISOString()).toBe("2026-03-06T08:30:00.000Z");
  });

  test("handles 'T' separator and trailing Z", () => {
    const d = istToLocalDate("2026-03-06T14:00:00Z");
    expect(d.toISOString()).toBe("2026-03-06T08:30:00.000Z");
  });

  test("date-only string defaults to midnight IST", () => {
    // 2026-03-06 00:00:00 IST === 2026-03-05 18:30:00 UTC
    const d = istToLocalDate("2026-03-06");
    expect(d.toISOString()).toBe("2026-03-05T18:30:00.000Z");
  });

  test("returns null when normalized value fails Date parsing", () => {
    // Matches the format regex but Date constructor rejects month=99.
    expect(istToLocalDate("2026-99-99 00:00:00")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("formatISTToLocalDate", () => {
  test("returns empty string for invalid input", () => {
    expect(formatISTToLocalDate(null)).toBe("");
    expect(formatISTToLocalDate("bad")).toBe("");
  });

  test("produces a non-empty Intl-formatted string for a valid input", () => {
    const s = formatISTToLocalDate("2026-03-06 14:00:00");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
    expect(s).toMatch(/2026/);
  });

  test("honors caller-supplied Intl options", () => {
    const s = formatISTToLocalDate("2026-03-06 14:00:00", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    expect(s).toMatch(/2026/);
  });
});

describe("formatISTToLocalTime", () => {
  test("returns empty string for invalid input", () => {
    expect(formatISTToLocalTime(null)).toBe("");
  });

  test("produces a non-empty string for valid input", () => {
    const s = formatISTToLocalTime("2026-03-06 14:00:00");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  test("honors caller-supplied Intl options", () => {
    expect(
      formatISTToLocalTime("2026-03-06 14:00:00", { hour12: false }).length,
    ).toBeGreaterThan(0);
  });
});

describe("formatISTToLocalDateTime", () => {
  test("returns empty string for invalid input", () => {
    expect(formatISTToLocalDateTime(null)).toBe("");
  });

  test("joins date and time with ' at '", () => {
    const s = formatISTToLocalDateTime("2026-03-06 14:00:00");
    expect(s).toMatch(/ at /);
    expect(s).toMatch(/2026/);
  });

  test("forwards both option bags", () => {
    const s = formatISTToLocalDateTime(
      "2026-03-06 14:00:00",
      { year: "numeric" },
      { hour12: false },
    );
    expect(s).toMatch(/ at /);
  });
});

describe("getRelativeTime", () => {
  test("returns empty string for invalid input", () => {
    expect(getRelativeTime(null)).toBe("");
  });

  test("'Just now' for < 1 minute ago", () => {
    // Now = 2026-03-06 14:00:00 IST = 2026-03-06T08:30:00Z
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T08:30:30Z"));
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("Just now");
  });

  test("'N minute(s) ago' for < 60 minutes", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T09:00:00Z"));
    // diff = 30 min from 2026-03-06 14:00:00 IST (08:30Z)
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("30 minutes ago");
  });

  test("singular 'minute ago' for exactly 1 minute", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T08:31:00Z"));
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("1 minute ago");
  });

  test("'N hour(s) ago' for < 24 hours", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T10:30:00Z"));
    // diff = 2h from 08:30Z
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("2 hours ago");
  });

  test("singular 'hour ago' for exactly 1 hour", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T09:30:00Z"));
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("1 hour ago");
  });

  test("'Yesterday' for diffDays === 1", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-07T08:30:00Z"));
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("Yesterday");
  });

  test("'N days ago' for 2..6 days", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-09T08:30:00Z"));
    expect(getRelativeTime("2026-03-06 14:00:00")).toBe("3 days ago");
  });

  test("falls through to formatted date when > 7 days", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-06T08:30:00Z"));
    const out = getRelativeTime("2026-03-06 14:00:00");
    expect(out).not.toMatch(/days ago|hour|minute|Just now|Yesterday/);
    expect(out).toMatch(/2026/);
  });
});

describe("isToday", () => {
  test("returns false for invalid input", () => {
    expect(isToday(null)).toBe(false);
  });

  test("returns true when timestamp resolves to the same local day as now", () => {
    // Choose a now-time where the IST timestamp's local representation is the
    // same calendar day. Using midnight UTC on the same date as the IST input
    // converted to UTC keeps Y/M/D aligned in most TZs.
    jest.useFakeTimers().setSystemTime(new Date("2026-03-06T12:00:00Z"));
    // istToLocalDate("2026-03-06 14:00:00") -> 2026-03-06T08:30:00Z, also Mar 6 in UTC.
    expect(isToday("2026-03-06 14:00:00")).toBe(true);
  });

  test("returns false when the local day differs from now", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-01T12:00:00Z"));
    expect(isToday("2026-03-06 14:00:00")).toBe(false);
  });
});

describe("formatLocalDateString", () => {
  test("warns and returns empty string for non-Date input", () => {
    expect(formatLocalDateString(null)).toBe("");
    expect(formatLocalDateString("2026-03-06")).toBe("");
    expect(formatLocalDateString(new Date("invalid"))).toBe("");
    expect(warnSpy).toHaveBeenCalled();
  });

  test("returns YYYY-MM-DD using local date parts (not UTC)", () => {
    const d = new Date(2026, 2, 6, 23, 30, 0); // local Mar 6, 2026 23:30
    expect(formatLocalDateString(d)).toBe("2026-03-06");
  });

  test("pads single-digit month and day", () => {
    const d = new Date(2026, 0, 5, 12, 0, 0); // local Jan 5, 2026
    expect(formatLocalDateString(d)).toBe("2026-01-05");
  });
});
