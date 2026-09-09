import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import { patientServices } from "./patient.services";
import sendResponse from "../../shared/sendResponse";
import { JwtPayload } from "jsonwebtoken";

const getPatientsController = catchAsync(
  async (req: Request, res: Response) => {
    const patients = await patientServices.getPatientsService(req.query);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Patients retrieved successfully",
      meta: patients.meta,
      data: patients.data,
    });
  },
);

const getPatientController = catchAsync(async (req: Request, res: Response) => {
  const patientId = req.params.id as string;
  const patient = await patientServices.getPatientService(patientId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Patient retrieved successfully",
    data: patient,
  });
});

const getPatientHealtProfileController = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const data = await patientServices.getPatientHealthProfileService(user);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Patient health profile retrieved successfully",
      data,
    });
  },
);

const updatePatientController = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as JwtPayload;
    const patient = await patientServices.updatePatientService(
      user,
      req.body,
      req.file,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Patient updated successfully",
      data: patient,
    });
  },
);

const deletePatientController = catchAsync(
  async (req: Request, res: Response) => {
    const patientId = req.params.id as string;
    const isDelete = req.body.isDelete as boolean;
    const patient = await patientServices.deletePatientService(
      patientId,
      isDelete,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `Patient ${isDelete ? "deleted" : "restored"} successfully`,
      data: patient,
    });
  },
);

export const patientControllers = {
  getPatientsController,
  getPatientController,
  getPatientHealtProfileController,
  updatePatientController,
  deletePatientController,
};
