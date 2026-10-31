import { z } from "zod"

export const SURGE_COLUMNS = "master_enabled,demand_enabled,demand_threshold_ratio,demand_multiplier,traffic_enabled,traffic_threshold_ratio,traffic_multiplier,max_total_multiplier"

export const surgeSettingsSchema = z.object({
  master_enabled: z.boolean(),
  demand_enabled: z.boolean(),
  demand_threshold_ratio: z.number().finite().min(0.1).max(100),
  demand_multiplier: z.number().finite().min(1).max(10),
  traffic_enabled: z.boolean(),
  traffic_threshold_ratio: z.number().finite().min(1).max(10),
  traffic_multiplier: z.number().finite().min(1).max(10),
  max_total_multiplier: z.number().finite().min(1).max(10),
}).strict()

export const busyPeriodSchema = z.object({
  label: z.string().trim().min(1).max(100),
  day_of_week: z.number().int().min(0).max(6).nullable(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  multiplier: z.number().finite().min(1).max(10),
  active: z.boolean(),
}).strict().refine(v => v.start_time.slice(0, 5) !== v.end_time.slice(0, 5), {
  message: "Choose different start and end times.",
})
