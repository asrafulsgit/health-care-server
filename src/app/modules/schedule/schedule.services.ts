import { addDays, addMinutes, addHours, format, parseISO } from "date-fns";
import { prisma } from "../../shared/prisma";
import QueryBuilder from "../../utils/queryBuilder";
import { buildDhakaDateTimeAsUtc } from "../../utils/timezoneFomate";

const createScheduleService = async (payload: Record<string, string>) => {
  const { startDate, endDate, startTime, endTime } = payload;

  const currentDate = parseISO(startDate);
  const lastDate = parseISO(endDate);

  const intervalTime = 30;
  const schedules = [];
  const now = new Date();

  const parseTimeTo24Hour = (time: string) => {
    const cleaned = time.trim().toLowerCase();

    const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);

    if (!match) {
      throw new Error(`Invalid time format: ${time}`);
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();

    if (hour > 23 || minute > 59) {
      throw new Error(`Invalid time: ${time}`);
    }

    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    }

    if (meridiem === "am" && hour === 12) {
      hour = 0;
    }

    return {
      hour,
      minute,
    };
  };

  const start = parseTimeTo24Hour(startTime);
  const end = parseTimeTo24Hour(endTime);

  // Validate working time
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (startMinutes >= endMinutes) {
    throw new Error("Start time must be before end time");
  }

  let current = currentDate;

  while (current <= lastDate) {
    const dayStartDateTime = buildDhakaDateTimeAsUtc(
      current,
      start.hour,
      start.minute,
    );

    const dayEndDateTime = buildDhakaDateTimeAsUtc(
      current,
      end.hour,
      end.minute,
    );

    let cursor = dayStartDateTime;

    while (cursor < dayEndDateTime) {
      const slotStartDateTime = new Date(cursor);

      const slotEndDateTime = addMinutes(slotStartDateTime, intervalTime);

      // Don't create a partial slot.
      if (slotEndDateTime > dayEndDateTime) {
        break;
      }

      // Don't create slots in the past
      if (slotStartDateTime < now) {
        cursor = addMinutes(cursor, intervalTime);
        continue;
      }

      // Check whether this exact schedule already exists
      const isExistSchedule = await prisma.schedule.findFirst({
        where: {
          startDateTime: slotStartDateTime,
          endDateTime: slotEndDateTime,
        },
      });

      if (!isExistSchedule) {
        const newSchedule = await prisma.schedule.create({
          data: {
            startDateTime: slotStartDateTime,
            endDateTime: slotEndDateTime,
          },
        });

        schedules.push(newSchedule);
      }

      cursor = addMinutes(cursor, intervalTime);
    }

    current = addDays(current, 1);
  }

  return schedules;
};

const getSchedulesService = async (query: Record<string, any>) => {
  const {
    startDate,
    endDate,
    sortBy = "startDateTime",
    sortOrder = "asc",
    page,
    limit = 30,
  } = query;

  const queryBuilder = new QueryBuilder({ ...query, sortBy, sortOrder, limit })
    .sort()
    .pagination()
    .build();

  const where: any = { ...queryBuilder.where };

  if (startDate || endDate || !startDate) {
    where.startDateTime = {};

    if (startDate) {
      where.startDateTime.gte = new Date(startDate);
    } else {
      where.startDateTime.gte = new Date();
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.startDateTime.lte = end;
    }
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      ...where,
    },
    ...queryBuilder.options,
  });

  const total = await prisma.schedule.count({
    where,
  });

  const limitNumber = Number(limit) || 10;
  return {
    meta: {
      total,
      page: Number(page) || 1,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
    data: schedules,
  };
};

export const scheduleServices = {
  createScheduleService,
  getSchedulesService,
};
