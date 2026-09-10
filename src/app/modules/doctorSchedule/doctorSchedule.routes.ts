import { Router } from "express"; 
import { authentication } from "../../middlewares/authentication";
import { UserRole } from "@prisma/client"; 
import { doctorScheduleControllers } from "./doctorSchedule.controllers";

const router = Router();

// get doctor available schedules
router.get(
  "/",
  authentication(UserRole.DOCTOR),
  doctorScheduleControllers.getDoctorAvailableSchedulesController
);

router.get(
  "/scheduled",
  authentication(UserRole.DOCTOR),
  doctorScheduleControllers.getDoctorSceduledSchedulesController
);

// get doctor schedules
router.get(
    '/:id',
    authentication(UserRole.PATIENT,UserRole.ADMIN),
    doctorScheduleControllers.getDoctorSchedulesController
)


// create doctor schedules
router.post(
  "/",
  authentication(UserRole.DOCTOR), 
  doctorScheduleControllers.createDoctorScheduleController,
);

// delete doctor schedule
router.delete(
    '/',
    authentication(UserRole.DOCTOR),
    doctorScheduleControllers.deleteDoctorScheduleController
);


export const doctorScheduleRouter = router;
