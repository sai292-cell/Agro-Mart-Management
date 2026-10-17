import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'Email or phone number is required' })
    .trim()
    .min(3, 'Identifier must be at least 3 characters')
    .max(120, 'Identifier cannot exceed 120 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password cannot exceed 128 characters'),
  shopId: z.string().optional(),
});

export const customerLoginRequestSchema = z.object({
  phone: z
    .string({ required_error: 'Mobile phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number cannot exceed 20 characters'),
  shopId: z.string().optional(),
});

export const customerVerifyOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Mobile phone number is required' })
    .trim()
    .min(7)
    .max(20),
  otp: z
    .string({ required_error: 'OTP code is required' })
    .trim()
    .min(4, 'OTP must be at least 4 digits')
    .max(8, 'OTP cannot exceed 8 digits'),
  shopId: z.string().optional(),
});

export const createStaffSchema = z
  .object({
    name: z
      .string({ required_error: 'Staff name is required' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z.string().trim().email('Invalid email address').optional(),
    phone: z
      .string()
      .trim()
      .min(7, 'Phone must be at least 7 digits')
      .max(20, 'Phone cannot exceed 20 digits')
      .optional(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    role: z.enum(['MANAGER', 'CASHIER'], {
      errorMap: () => ({ message: 'Privileged role must be MANAGER or CASHIER (OWNER cannot be created here)' }),
    }),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone number must be provided for staff accounts',
    path: ['email'],
  });

export const updateStaffRoleSchema = z.object({
  role: z.enum(['MANAGER', 'CASHIER'], {
    errorMap: () => ({ message: 'Role must be MANAGER or CASHIER' }),
  }),
});

export const updateStaffStatusSchema = z.object({
  active: z.boolean({ required_error: 'Active status (boolean) is required' }),
});
