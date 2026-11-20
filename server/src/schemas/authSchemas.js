const { z } = require("zod");

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email().transform((v) => v.trim().toLowerCase()),
    password: z.string().min(6),
    role: z.string().optional(),
    mobile: z.string().optional(),
    regCode: z.string().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email().transform((v) => v.trim().toLowerCase()),
    password: z.string().min(4),
  }),
});

module.exports = { registerSchema, loginSchema };
