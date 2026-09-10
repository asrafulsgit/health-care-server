import { addMinutes, addHours, format, parseISO } from "date-fns";

const DHAKA_UTC_OFFSET_HOURS = 6; // Bangladesh Standard Time, fixed offset, no DST

export const buildDhakaDateTimeAsUtc = (date: Date, hour: number, minute: number) => {
  const dateStr = format(date, "yyyy-MM-dd");

  const utcMidnight = new Date(`${dateStr}T00:00:00.000Z`);

  const asIfUtc = addMinutes(addHours(utcMidnight, hour), minute);

  return addHours(asIfUtc, -DHAKA_UTC_OFFSET_HOURS);
};
