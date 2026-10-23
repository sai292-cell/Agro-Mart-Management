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

export const customerRegisterSchema = z
  .object({
    name: z
      .string({ required_error: 'Full name is required / पूर्ण नाव आवश्यक आहे' })
      .trim()
      .min(2, 'Name must be at least 2 characters / नाव किमान २ अक्षरांचे असावे')
      .max(100, 'Name cannot exceed 100 characters / नाव १०० अक्षरांपेक्षा जास्त नसावे'),
    phone: z
      .string({ required_error: 'Mobile number is required / मोबाईल क्रमांक आवश्यक आहे' })
      .trim()
      .refine(
        (val) => {
          const digits = val.replace(/\D/g, '');
          const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
          return tenDigits.length === 10 && /^[6-9]\d{9}$/.test(tenDigits);
        },
        {
          message: 'Please enter a valid 10-digit Indian mobile number / कृपया वैध १० अंकी मोबाईल नंबर टाका',
        }
      ),
    email: z
      .string()
      .trim()
      .email('Invalid email address format / अमान्य ईमेल स्वरूप')
      .max(120, 'Email cannot exceed 120 characters')
      .optional()
      .or(z.literal('')),
    password: z
      .string({ required_error: 'Password is required / पासवर्ड आवश्यक आहे' })
      .min(8, 'Password must be at least 8 characters / पासवर्ड किमान ८ अक्षरांचा असावा')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number / पासवर्डमध्ये किमान एक मोठे अक्षर, एक लहान अक्षर आणि एक अंक असावा'
      ),
    confirmPassword: z
      .string({ required_error: 'Confirm password is required / पासवर्डची खात्री करा' })
      .min(8, 'Confirm password must be at least 8 characters')
      .max(128),
    village: z
      .string({ required_error: 'Village is required / गाव आवश्यक आहे' })
      .trim()
      .min(1, 'Village is required / गाव आवश्यक आहे')
      .max(100, 'Village cannot exceed 100 characters'),
    taluka: z
      .string({ required_error: 'Taluka is required / तालुका आवश्यक आहे' })
      .trim()
      .min(1, 'Taluka is required / तालुका आवश्यक आहे')
      .max(100, 'Taluka cannot exceed 100 characters'),
    district: z
      .string({ required_error: 'District is required / जिल्हा आवश्यक आहे' })
      .trim()
      .min(1, 'District is required / जिल्हा आवश्यक आहे')
      .max(100, 'District cannot exceed 100 characters'),
    state: z
      .string()
      .trim()
      .max(100)
      .default('Maharashtra'),
    preferredLanguage: z
      .enum(['mr', 'en'], {
        errorMap: () => ({ message: 'Preferred language must be Marathi (mr) or English (en)' }),
      })
      .default('mr'),
    age: z
      .number({ invalid_type_error: 'Age must be a number' })
      .int('Age must be a whole number')
      .min(18, 'Age must be at least 18')
      .max(120, 'Age cannot exceed 120')
      .optional()
      .nullable(),
    gender: z
      .enum(['MALE', 'FEMALE', 'OTHER'], {
        errorMap: () => ({ message: 'Gender must be MALE, FEMALE, or OTHER' }),
      })
      .optional()
      .nullable(),
    shopId: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password and Confirm Password do not match / दोन्ही पासवर्ड जुळत नाहीत',
    path: ['confirmPassword'],
  });

export const customerPasswordLoginSchema = z.object({
  farmerId: z
    .string({ required_error: 'Farmer ID is required / शेतकरी आयडी आवश्यक आहे' })
    .trim()
    .min(3, 'Farmer ID must be at least 3 characters')
    .max(50, 'Farmer ID cannot exceed 50 characters'),
  password: z
    .string({ required_error: 'Password is required / पासवर्ड आवश्यक आहे' })
    .min(1, 'Password is required / पासवर्ड आवश्यक आहे')
    .max(128, 'Password cannot exceed 128 characters'),
  shopId: z.string().optional(),
});

export const ownerResetCustomerPasswordSchema = z
  .object({
    newPassword: z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmNewPassword: z
      .string({ required_error: 'Confirm password is required' })
      .min(8, 'Confirm password must be at least 8 characters')
      .max(128),
    reason: z
      .string()
      .trim()
      .max(255)
      .optional()
      .default('Owner-verified in-person identity password reset'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New password and confirm password do not match',
    path: ['confirmNewPassword'],
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
