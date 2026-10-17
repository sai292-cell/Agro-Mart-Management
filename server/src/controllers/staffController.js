import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { hashPassword, formatSafeUser } from '../utils/tokenUtils.js';
import {
  createStaffSchema,
  updateStaffRoleSchema,
  updateStaffStatusSchema,
} from '../validators/authValidators.js';

/**
 * GET /api/v1/staff
 * Lists all staff members (Manager, Cashier, Owner) for the authenticated shop
 * Restricted to OWNER and MANAGER
 */
export async function listStaff(req, res, next) {
  try {
    const staffMembers = await User.find({
      shopId: req.user.shopId,
      role: { $in: ['OWNER', 'MANAGER', 'CASHIER'] },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        staff: staffMembers.map(formatSafeUser),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/staff
 * Creates a new staff account (MANAGER or CASHIER)
 * Strictly restricted to OWNER
 */
export async function createStaff(req, res, next) {
  try {
    const parseResult = createStaffSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { name, email, phone, password, role } = parseResult.data;

    // Check for duplicate email or phone within this shop
    const duplicateQuery = {
      shopId: req.user.shopId,
      $or: [],
    };
    if (email) duplicateQuery.$or.push({ email: email.toLowerCase() });
    if (phone) duplicateQuery.$or.push({ phone });

    if (duplicateQuery.$or.length > 0) {
      const existing = await User.findOne(duplicateQuery);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'STAFF_ALREADY_EXISTS',
            message: 'A user account with this email or phone number already exists.',
          },
        });
      }
    }

    const passwordHash = await hashPassword(password);

    const newStaff = await User.create({
      shopId: req.user.shopId,
      name,
      email: email ? email.toLowerCase() : undefined,
      phone: phone || undefined,
      passwordHash,
      role, // Strictly MANAGER or CASHIER per schema validation
      active: true,
      emailVerified: !!email,
      phoneVerified: !!phone,
    });

    // Record immutable audit log
    await AuditLog.create({
      shopId: req.user.shopId,
      actorUserId: req.userId,
      action: 'STAFF_CREATED',
      entityType: 'USER',
      entityId: newStaff._id.toString(),
      reason: `New staff account created with role ${role}`,
      metadata: {
        staffName: newStaff.name,
        role: newStaff.role,
        assignedBy: req.user.name,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        staff: formatSafeUser(newStaff),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/staff/:id/role
 * Changes staff member role (strictly restricted to OWNER)
 */
export async function updateStaffRole(req, res, next) {
  try {
    const { id } = req.params;
    const parseResult = updateStaffRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { role } = parseResult.data;

    const staff = await User.findOne({ _id: id, shopId: req.user.shopId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        error: { code: 'STAFF_NOT_FOUND', message: 'Staff member not found.' },
      });
    }

    // Protection: Cannot demote the OWNER or change OWNER role via this endpoint
    if (staff.role === 'OWNER') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'OWNER_ROLE_PROTECTED',
          message: 'The Shop Owner role cannot be modified or re-assigned through staff management.',
        },
      });
    }

    const oldRole = staff.role;
    staff.role = role;
    await staff.save();

    // Audit log
    await AuditLog.create({
      shopId: req.user.shopId,
      actorUserId: req.userId,
      action: 'STAFF_ROLE_CHANGED',
      entityType: 'USER',
      entityId: staff._id.toString(),
      reason: `Staff role changed from ${oldRole} to ${role}`,
      metadata: { oldRole, newRole: role, updatedBy: req.user.name },
    });

    return res.status(200).json({
      success: true,
      data: {
        staff: formatSafeUser(staff),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/staff/:id/status
 * Activates or deactivates a staff member account (Strictly restricted to OWNER)
 */
export async function updateStaffStatus(req, res, next) {
  try {
    const { id } = req.params;
    const parseResult = updateStaffStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { active } = parseResult.data;

    const staff = await User.findOne({ _id: id, shopId: req.user.shopId });
    if (!staff) {
      return res.status(404).json({
        success: false,
        error: { code: 'STAFF_NOT_FOUND', message: 'Staff member not found.' },
      });
    }

    if (staff.role === 'OWNER') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CANNOT_DEACTIVATE_OWNER',
          message: 'The primary Shop Owner account cannot be deactivated.',
        },
      });
    }

    staff.active = active;
    await staff.save();

    // Audit log
    await AuditLog.create({
      shopId: req.user.shopId,
      actorUserId: req.userId,
      action: active ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      entityType: 'USER',
      entityId: staff._id.toString(),
      reason: `Staff account ${active ? 'activated' : 'deactivated'}`,
      metadata: { active, updatedBy: req.user.name },
    });

    return res.status(200).json({
      success: true,
      data: {
        staff: formatSafeUser(staff),
      },
    });
  } catch (err) {
    next(err);
  }
}
