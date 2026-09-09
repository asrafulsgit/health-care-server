import { z } from "zod";

const paramValidation = z.object({
  params: z.object({
    id: z.string().trim().uuid("Invalid medical report ID."),
  }),
});

const deletePatientValidation = z.object({
  body: z.object({
    isDelete: z.boolean(),
  }),
  params: z.object({
    id: z.string().trim().uuid("Invalid patient ID."),
  }),
});

export const patientValidators = {
  paramValidation,
  deletePatientValidation,
};
