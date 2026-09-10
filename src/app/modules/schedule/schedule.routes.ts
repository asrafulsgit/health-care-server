import { Router } from "express";
import { scheduleControllers } from "./schedule.controllers";
import { authentication } from "../../middlewares/authentication";
import { UserRole } from "@prisma/client";
import { sheludeValidators } from "./schedule.validation";
import validateRequest from "../../middlewares/validateRequest";

const router = Router();

router.post(
  "/",
  authentication(UserRole.ADMIN),
  validateRequest(sheludeValidators.createScheduleSchema),
  scheduleControllers.createScheduleController,
);
router.get(
  "/",
  authentication(UserRole.ADMIN),
  scheduleControllers.getSchedulesController
);

export const scheduleRouter = router;
