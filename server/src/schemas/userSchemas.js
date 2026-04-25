const { z } = require("zod");

const userCreateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.string().optional(),
    mobile: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

const userUpdateSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
    mobile: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
});

module.exports = { userCreateSchema, userUpdateSchema };
