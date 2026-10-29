import { z } from "zod"
import type { TFunction } from "i18next"

import { isFormPhoneValid } from "@/lib/phone"

export const createCustomerSchema = (t: TFunction) =>
  z.object({
    firstName: z.string().min(1, t("first_name_required")),
    lastName: z.string().nullable().optional(),
    identificationTypeId: z.coerce.number().min(1).max(2),
    identificationNumber: z.string().min(1, t("document_required")),
    address: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional().refine(isFormPhoneValid, t("common:phone_required_valid")),
    emailAddress: z.string().email(t("email_invalid")).nullable().optional(),
    city: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
  })

export type CreateCustomerFormValues = z.infer<ReturnType<typeof createCustomerSchema>>
