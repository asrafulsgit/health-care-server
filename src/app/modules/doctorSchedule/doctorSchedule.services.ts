import { prisma } from "../../shared/prisma";
import QueryBuilder from "../../utils/queryBuilder";
import AppError from "../../errorHelpers/appError";
import httpStatus from "http-status";
import { Prisma } from "@prisma/client";

const createDoctorScheduleService = async (
  email: string,
  payload: {
    schedules: string[];
  },
) => {
  const schedules = payload.schedules;

  const doctorData = await prisma.doctor.findUniqueOrThrow({
    where: {
      email,
    },
  });

  const scheduleRecords = await prisma.schedule.findMany({
    where: {
      id: { in: schedules },
    },
  });

  const now = new Date();

  const pastSchedule = scheduleRecords.find(
    (schedule) => schedule.startDateTime < now,
  );

  if (pastSchedule) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot assign past schedules to doctor",
    );
  }

  const scheduleData = schedules.map((schedule) => ({
    doctorId: doctorData.id,
    scheduleId: schedule,
  }));

  await prisma.doctorSchedules.createMany({
    data: scheduleData,
  });
};

const getDoctorAvailableSchedulesService = async (
  email: string,
  query: Record<string, any>,
) => {
  const {
    startDate,
    endDate,
    sortBy = "startDateTime",
    sortOrder = "asc",
    page,
    limit = 30,
  } = query;
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const queryBuilder = new QueryBuilder({ ...query, limit, sortBy, sortOrder })
    .sort()
    .pagination()
    .build();

  const where: any = { ...queryBuilder.where };
  if (startDate || endDate) {
    where.startDateTime = {};

    if (startDate) {
      where.startDateTime.gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.startDateTime.lte = end;
    }
  }

  if (!startDate) {
    where.startDateTime = {
      gte: twoHoursFromNow,
    };
  }

  const doctorSchedules = await prisma.doctorSchedules.findMany({
    where: {
      doctor: {
        email,
      },
      schedule: {
        startDateTime: {
          gte: twoHoursFromNow,
        },
      },
    },
    select: {
      scheduleId: true,
    },
  });

  const scheduleIds = doctorSchedules.map((schedule) => schedule.scheduleId);

  const schedules = await prisma.schedule.findMany({
    where: {
      ...where,
      id: {
        notIn: scheduleIds,
      },
    },
    ...queryBuilder.options,
  });

  const total = await prisma.schedule.count({
    where: {
      ...where,
      id: {
        notIn: scheduleIds,
      },
    },
  });

  const limitNumber = Number(limit) || 30;
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

const getDoctorScheduledSchedulesService = async (
  email: string,
  query: Record<string, any>,
) => {
  const { startDate, endDate, page, limit = 30, sortBy = "startDateTime",
    sortOrder = "asc", } = query;

  const where: any = {
    doctor: { email },
  };

  if (startDate || endDate || !startDate) {
    where.schedule = { startDateTime: {} };

    if (startDate) {
      where.schedule.startDateTime.gte = new Date(startDate);
    } else {
      where.schedule.startDateTime.gte = new Date();
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.schedule.startDateTime.lte = end;
    }
  }
  const orderBy = sortBy
    ? {
        schedule: {
          [sortBy]: (sortOrder === "desc"
            ? "desc"
            : "asc") as Prisma.SortOrder,
        },
      }
    : {
        schedule: {
          startDateTime: "asc" as Prisma.SortOrder,
        },
      };

  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 30;
  const skip = (pageNumber - 1) * limitNumber;

  const [doctorSchedules, total] = await Promise.all([
    prisma.doctorSchedules.findMany({
      where,
      include: {
        schedule: true,
      },
      orderBy,
      skip,
      take: limitNumber,
    }),
    prisma.doctorSchedules.count({ where }),
  ]);

  const schedules = doctorSchedules.map(({ schedule, isBooked }) => ({
    ...schedule,
    isBooked,
  }));
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

const getDoctorSchedulesService = async (
  id: string,
  query: Record<string, any>,
) => {
  const { startDate, endDate, page, limit } = query;
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const queryBuilder = new QueryBuilder(query)
    .filter()
    .sort()
    .pagination()
    .build();

  const where: any = { ...queryBuilder.where };

  if (startDate || endDate) {
    where.schedule = where.schedule || {};
    where.schedule.startDateTime = {};

    if (startDate) {
      where.schedule.startDateTime.gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.schedule.startDateTime.lte = end;
    }
  }

  if (!startDate) {
    where.schedule = where.schedule || {};
    where.schedule.startDateTime = {};
    where.schedule.startDateTime.gte = twoHoursFromNow;
  }

  const doctorData = await prisma.doctor.findUniqueOrThrow({
    where: {
      id,
    },
    include: {
      doctorSpecialities: {
        include: {
          specialities: true,
        },
      },
    },
  });

  const doctorSchedules = await prisma.doctorSchedules.findMany({
    where: {
      ...where,
      doctorId: id,
    },
    ...queryBuilder.options,
    include: {
      schedule: true,
    },
  });

  const total = await prisma.doctorSchedules.count({
    where: {
      ...where,
      doctorId: id,
    },
  });

  const limitNumber = Number(limit) || 10;
  return {
    meta: {
      total,
      page: Number(page) || 1,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
    },
    data: {
      doctor: doctorData,
      doctorSchedules,
    },
  };
};

const deleteDoctorScheduleService = async (
  email: string,
  payload: { schedules: string[] },
) => {
  const { schedules } = payload;

  if (!schedules?.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No schedules provided for deletion",
    );
  }

  const now = new Date();

  const existing = await prisma.doctorSchedules.findMany({
    where: {
      doctor: {
        email,
      },
      scheduleId: { in: schedules },
    },
    select: {
      scheduleId: true,
      isBooked: true,
      schedule: { select: { startDateTime: true } },
    },
  });

  if (existing.length === 0) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "None of the provided schedules are assigned to this doctor",
    );
  }

  const deletableIds = existing
    .filter((s) => s.isBooked === false && s.schedule.startDateTime > now)
    .map((s) => s.scheduleId);

  if (deletableIds.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No schedules can be deleted – all are either past or already booked",
    );
  }

  await prisma.doctorSchedules.deleteMany({
    where: {
      doctor: { email },
      scheduleId: { in: deletableIds },
    },
  });
};

export const doctorScheduleServices = {
  createDoctorScheduleService,
  getDoctorAvailableSchedulesService,
  getDoctorScheduledSchedulesService,
  getDoctorSchedulesService,
  deleteDoctorScheduleService,
};
