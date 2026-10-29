import { z } from 'zod';

// Response shapes the screens rely on. The backend's generated OpenAPI spec does not
// describe these (relations are untyped, some routes are missing), so they are declared
// here and checked on every response.

export const geoSchema = z
  .object({
    geo_json: z
      .object({
        geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }).optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

export const addressSchema = z.object({
  id: z.number(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable(),
  is_primary: z.number(),
  city: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
  geo: geoSchema,
});

export const deviceSchema = z.object({
  id: z.number(),
  device_type: z.string(),
  device_serial: z.string(),
  geo: geoSchema,
});

export const personSchema = z.object({
  id: z.number(),
  title: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  name: z.string(),
  surname: z.string(),
  gender: z.string().nullable(),
  birth_date: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  addresses: z.array(addressSchema),
  devices: z.array(deviceSchema),
  agent: z.object({ id: z.number() }).nullable(),
});
export type Person = z.infer<typeof personSchema>;
export type Address = z.infer<typeof addressSchema>;

export const rateSchema = z.object({
  id: z.number(),
  rate_cost: z.number(),
  remaining: z.number(),
  // Due dates arrive as "2026-11-28 00:00:00", which browsers read in local time; only the day matters.
  due_date: z.string().transform((value) => value.slice(0, 10)),
});
export type Rate = z.infer<typeof rateSchema>;

export const applianceSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  appliance_type: z.object({ id: z.number(), name: z.string() }).optional(),
});
export type Appliance = z.infer<typeof applianceSchema>;

export const contractSchema = z.object({
  id: z.number(),
  total_cost: z.number(),
  rate_count: z.number(),
  down_payment: z.number().nullable(),
  device_serial: z.string().nullable(),
  payment_type: z.enum(['installment', 'energy_service']),
  price_per_day: z.number().nullable(),
  created_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  appliance: applianceSchema.nullable(),
  rates: z.array(rateSchema),
});
export type Contract = z.infer<typeof contractSchema>;

export const paymentSchema = z.object({
  id: z.number(),
  amount: z.number(),
  payment_service: z.string().nullable(),
  payment_type: z.string(),
  created_at: z.string(),
  transaction: z
    .object({
      message: z.string().nullable(),
      token: z
        .object({
          token: z.string(),
          token_amount: z.number().nullable(),
          token_unit: z.string().nullable(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const documentSchema = z.object({
  id: z.number(),
  name: z.string(),
  original_name: z.string().nullable().optional(),
  created_at: z.string().nullable(),
});
export type CustomerDocument = z.infer<typeof documentSchema>;

export const ticketSchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.number(),
  created_at: z.string().nullable(),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const stockDeviceSchema = z.object({
  id: z.number(),
  device_serial: z.string(),
  person_id: z.number().nullable(),
});
export type StockDevice = z.infer<typeof stockDeviceSchema>;

export const dataOf = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
export const pageOf = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: z.array(schema),
    current_page: z.number(),
    last_page: z.number(),
    total: z.number(),
  });

// Laravel paginators arrive unwrapped: the page fields sit next to `data`.
export const paginatorOf = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: z.array(schema),
    current_page: z.number(),
    last_page: z.number(),
    per_page: z.coerce.number(),
    total: z.number(),
    from: z.number().nullable(),
    to: z.number().nullable(),
  });
