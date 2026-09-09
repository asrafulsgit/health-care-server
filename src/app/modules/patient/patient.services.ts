import { AppointmentStatus, Patient, Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import QueryBuilder from "../../utils/queryBuilder";
import { IPatientUpdate } from "./patient.interface";
import AppError from "../../errorHelpers/appError";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import { getPatientByUserEmail } from "../../utils/getPatient";
import { deleteCloudinaryImage } from "../../config/cloudinary";

const getPatientsService = async (query: Record<string, any>) => {
  const queryBuilder = new QueryBuilder(query)
    .search(["name", "email", "contactNumber", "address"])
    .filter()
    .sort()
    .pagination()
    .build();

  const patients = await prisma.patient.findMany({
    where: {
      ...queryBuilder.where,
    },
    ...queryBuilder.options,
    include: {
      patientHealthData: true,
      appointments: {
        where: { status: AppointmentStatus.COMPLETED },
        orderBy: { schedule: { startDateTime: Prisma.SortOrder.desc } },
        take: 1,
        select: {
          schedule: {
            select: { startDateTime: true },
          },
        },
      },
      _count: {
        select: {
          appointments: {
            where: { status: AppointmentStatus.COMPLETED },
          },
        },
      },
    },
  });

  const total = await prisma.patient.count({
    where: queryBuilder.where,
  });

  const limit = Number(query.limit) || 10;
  return {
    meta: {
      total,
      page: Number(query.page) || 1,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    data: patients,
  };
};

const getPatientHealthProfileService = async (user: JwtPayload) => {
  const result = await prisma.patient.findUniqueOrThrow({
    where: {
      email: user.email,
    },
    include: {
      patientHealthData: true,
    },
  });

  return result;
};

const getPatientService = async (id: string) => {
  const patientInclude = {
    prescriptions: {
      include: {
        doctor: {
          select: {
            name: true,
          },
        },
        medications: true,
      },
    },
    medicalReport: true,
    patientHealthData: true,
    appointments: {
      where: { status: AppointmentStatus.COMPLETED },
      orderBy: { schedule: { startDateTime: Prisma.SortOrder.desc } },
      take: 1,
      select: {
        doctor: {
          select: {
            name: true,
            doctorSpecialities: {
              select: {
                specialities: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
        schedule: {
          select: { startDateTime: true },
        },
      },
    },
    _count: {
      select: {
        appointments: {
          where: { status: AppointmentStatus.COMPLETED },
        },
      },
    },
  };

  const patient = (await prisma.patient.findFirstOrThrow({
    where: { id },
    include: patientInclude,
  })) as Prisma.PatientGetPayload<{ include: typeof patientInclude }>;

  const { appointments, _count, ...rest } = patient;

  const data = {
    ...rest,
    lastVisit: appointments[0]?.schedule?.startDateTime ?? null,
    totalVisits: _count.appointments,
    lastConsultant: appointments[0].doctor,
  };

  return data;
};

const updatePatientService = async (
  user: JwtPayload,
  payload: Partial<IPatientUpdate>,
  file?: Express.Multer.File,
) => {
  const { patientHealthData, medicalReport, ...patientData } = payload;

  const patientInfo = await getPatientByUserEmail(user);
  const previousPhoto = patientInfo.profilePhoto;
  if (patientInfo.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Your account is temporarily deleted",
    );
  }

  await prisma.$transaction(async (tnx) => {
    await tnx.patient.update({
      where: {
        id: patientInfo.id,
      },
      data: {
        name: patientData.name,
        profilePhoto: file?.path,
        address: patientData.address,
        contactNumber: patientData.contactNumber,
      },
      include: {
        patientHealthData: true,
        medicalReport: true,
      },
    });
    if (patientHealthData) {
      await tnx.patientHealthData.upsert({
        where: {
          patientId: patientInfo.id,
        },
        update: patientHealthData,
        create: { ...patientHealthData, patientId: patientInfo.id },
      });
    }

    if (medicalReport) {
      await tnx.medicalReport.create({
        data: { ...medicalReport, patientId: patientInfo.id },
      });
    }
  });

  if (previousPhoto && file) {
    await deleteCloudinaryImage(previousPhoto);
  }

  const responseData = await prisma.patient.findUnique({
    where: {
      id: patientInfo.id,
    },
    include: {
      patientHealthData: true,
      medicalReport: true,
    },
  });
  return responseData;
};

const deletePatientService = async (id: string, isDelete: boolean) => {
  const patientInfo = await prisma.patient.findUniqueOrThrow({
    where: {
      id,
    },
  });

  if (patientInfo.isDeleted && isDelete) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This patient is already deleted",
    );
  }

  if (!patientInfo.isDeleted && !isDelete) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This patient is already active",
    );
  }

  return await prisma.$transaction(async (tnx) => {
    const updatedPatient = await tnx.patient.update({
      where: { id },
      data: {
        isDeleted: isDelete,
      },
    });

    await tnx.user.update({
      where: {
        email: updatedPatient.email,
      },
      data: {
        status: isDelete ? UserStatus.DELETED : UserStatus.ACTIVE,
      },
    });

    return updatedPatient;
  });
};

export const patientServices = {
  getPatientsService,
  getPatientService,
  getPatientHealthProfileService,
  updatePatientService,
  deletePatientService,
};
