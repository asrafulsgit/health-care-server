import { patientControllers } from "./patient.controllers";
import { authentication } from "../../middlewares/authentication";
import { UserRole } from "@prisma/client";
import { Router } from "express";
import { multerUpload } from "../../config/multer";
import validateRequest from "../../middlewares/validateRequest";
import { patientValidators } from "./patient.validation";

const router = Router();

router.get(
  "/",
  authentication(UserRole.ADMIN),
  patientControllers.getPatientsController,
);

router.get(
  "/profile",
  authentication(UserRole.PATIENT),
  patientControllers.getPatientHealtProfileController,
);

router.get(
  "/:id",
  validateRequest(patientValidators.paramValidation),
  authentication(UserRole.DOCTOR, UserRole.ADMIN),
  patientControllers.getPatientController,
);

router.patch(
  "/",
  authentication(UserRole.PATIENT),
  multerUpload.single("avatar"),
  patientControllers.updatePatientController,
);

router.delete(
  "/:id",
  validateRequest(patientValidators.deletePatientValidation),
  authentication(UserRole.ADMIN),
  patientControllers.deletePatientController,
);



export const patientRouter = router;
