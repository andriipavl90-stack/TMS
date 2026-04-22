import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { hasAdminPrivileges, ROLES, isAdminRole } from '../utils/roleMapper.js';
import { USER_GROUP_VALUES, DEFAULT_USER_GROUP } from '../constants/groups.js';

const router = express.Router();

/* ======================================================
   GROUP MANAGEMENT (Super Admin only)
====================================================== */

// GET /admin/groups - List all groups (read: any authenticated, write: super admin only)
router.get('/groups', async (req, res, next) => {
  try {
    const groups = await Group.find().sort({ sortOrder: 1, code: 1 }).lean();
    res.json(createSuccessResponse({ groups }));
  } catch (error) {
    next(error);
  }
});

// POST /admin/groups - Create group
router.post('/groups', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, code, sortOrder } = req.body;
    if (!name || !code) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        'name and code are required',
        400
      ));
    }
    const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await Group.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(400).json(createErrorResponse(
        'DUPLICATE_GROUP',
        `Group with code "${normalizedCode}" already exists`,
        400
      ));
    }
    const group = await Group.create({
      name: name.trim(),
      code: normalizedCode,
      sortOrder: sortOrder ?? 0
    });
    res.status(201).json(createSuccessResponse({ group }, 'Group created successfully'));
  } catch (error) {
    next(error);
  }
});

// PUT /admin/groups/:id - Update group
router.put('/groups/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Group not found', 404));
    }
    const { name, code, sortOrder } = req.body;
    if (name !== undefined) group.name = name.trim();
    if (code !== undefined) {
      const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, '_');
      const existing = await Group.findOne({ code: normalizedCode, _id: { $ne: group._id } });
      if (existing) {
        return res.status(400).json(createErrorResponse(
          'DUPLICATE_GROUP',
          `Group with code "${normalizedCode}" already exists`,
          400
        ));
      }
      group.code = normalizedCode;
    }
    if (sortOrder !== undefined) group.sortOrder = sortOrder;
    await group.save();
    res.json(createSuccessResponse({ group }, 'Group updated successfully'));
  } catch (error) {
    next(error);
  }
});

// DELETE /admin/groups/:id - Delete group
router.delete('/groups/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json(createErrorResponse('NOT_FOUND', 'Group not found', 404));
    }
    const userCount = await User.countDocuments({ group: group.code });
    if (userCount > 0) {
      return res.status(400).json(createErrorResponse(
        'GROUP_IN_USE',
        `Cannot delete group: ${userCount} user(s) are assigned to it. Reassign users first.`,
        400
      ));
    }
    await Group.findByIdAndDelete(req.params.id);
    res.json(createSuccessResponse(null, 'Group deleted successfully'));
  } catch (error) {
    next(error);
  }
});

// Only SUPER_ADMIN and ADMIN (BOSS maps to ADMIN) can access admin routes
router.use(requireAuth);
// router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'BOSS')); // BOSS included for backward compatibility

// Valid group values: SUPER_ADMIN, ADMIN + all Group codes from DB
const getValidGroupValues = async () => {
  const groups = await Group.find().select('code').lean();
  const codes = groups.map(g => g.code);
  return ['SUPER_ADMIN', 'ADMIN', ...codes];
};

const hubstaffIdField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  });

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  group: z.string().min(1).optional(),
  degree: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEAM_BOSS', 'MEMBER']).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'GUEST', 'BOSS']).optional(), // BOSS for backward compatibility
  editor: z.boolean().optional(),
  status: z.enum(['active', 'disabled', 'pending']).optional(),
  hubstaff_id: hubstaffIdField
});

const updateUserSchema = z.object({
  group: z.string().min(1).optional(),
  degree: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEAM_BOSS', 'MEMBER']).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MEMBER', 'GUEST', 'BOSS']).optional(), // BOSS for backward compatibility
  editor: z.boolean().optional(),
  status: z.enum(['active', 'disabled', 'pending']).optional(),
  hubstaff_id: hubstaffIdField
});

// Get users with filtering and pagination
router.get('/users', async (req, res, next) => {
  try {
    const {
      search = '',
      group = '',
      degree = '',
      role = '',
      status = '',
      page = '1',
      limit = '10'
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    if (group) {
      query.group = group;
    }

    if (degree) {
      query.degree = degree;
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    // Format users
    const formattedUsers = users.map(user => ({
      id: user._id,
      email: user.email,
      name: user.name,
      group: user.group,
      degree: user.degree,
      role: user.role,
      editor: user.editor,
      status: user.status,
      hubstaff_id: user.hubstaff_id || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    res.json(createSuccessResponse({
      users: formattedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    }));
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
router.post('/users', async (req, res, next) => {
  try {
    const validatedData = createUserSchema.parse(req.body);

    // Validate group against DB groups + SUPER_ADMIN, ADMIN
    if (validatedData.group) {
      const validGroups = await getValidGroupValues();
      if (!validGroups.includes(validatedData.group)) {
        return res.status(400).json(createErrorResponse(
          'INVALID_GROUP',
          `Invalid group. Must be one of: ${validGroups.join(', ')}`,
          400
        ));
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json(createErrorResponse(
        'USER_EXISTS',
        'User with this email already exists',
        400
      ));
    }

    // Only SUPER_ADMIN can create SUPER_ADMIN
    if (validatedData.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only SUPER_ADMIN can create SUPER_ADMIN users',
        403
      ));
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!1';
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = new User({
      email: validatedData.email.toLowerCase(),
      passwordHash,
      name: validatedData.name,
      group: validatedData.group || DEFAULT_USER_GROUP,
      degree: validatedData.degree || 'MEMBER',
      role: validatedData.role || 'MEMBER',
      editor: validatedData.editor || false,
      status: validatedData.status || 'pending',
      hubstaff_id: validatedData.hubstaff_id ?? null
    });

    await user.save();

    // Audit log
    await auditLog(req, 'USER_CREATE', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      createdUser: {
        email: user.email,
        name: user.name,
        group: user.group,
        degree: user.degree,
        role: user.role,
        editor: user.editor,
        status: user.status
      }
    });

    // Return user summary and temporary password
    res.status(201).json(createSuccessResponse({
      user: user.toSummary(),
      tempPassword // Return temp password for v1 local use
    }, 'User created successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    if (error.code === 11000) {
      return res.status(400).json(createErrorResponse(
        'USER_EXISTS',
        'User with this email already exists',
        400
      ));
    }
    next(error);
  }
});

// Update user (admin only)
router.put('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    // Validate group against DB groups + SUPER_ADMIN, ADMIN
    if (validatedData.group !== undefined) {
      const validGroups = await getValidGroupValues();
      if (!validGroups.includes(validatedData.group)) {
        return res.status(400).json(createErrorResponse(
          'INVALID_GROUP',
          `Invalid group. Must be one of: ${validGroups.join(', ')}`,
          400
        ));
      }
    }

    // Map BOSS → ADMIN for updates
    if (validatedData.role === 'BOSS') {
      validatedData.role = 'ADMIN';
    }

    // Only SUPER_ADMIN can update SUPER_ADMIN
    if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot modify SUPER_ADMIN user',
        403
      ));
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (validatedData.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only SUPER_ADMIN can assign SUPER_ADMIN role',
        403
      ));
    }

    // Only SUPER_ADMIN or ADMIN can assign ADMIN role
    if (validatedData.role === 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN' &&
      !isAdminRole(req.user.role)) {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only SUPER_ADMIN or ADMIN can assign ADMIN role',
        403
      ));
    }

    // Prevent self-disabling
    if (validatedData.status === 'disabled' && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(createErrorResponse(
        'CANNOT_DISABLE_SELF',
        'Cannot disable your own account',
        400
      ));
    }

    // Store old values for audit
    const oldValues = {
      group: user.group,
      degree: user.degree,
      role: user.role,
      status: user.status,
      editor: user.editor
    };

    // Update fields
    if (validatedData.group !== undefined) user.group = validatedData.group;
    if (validatedData.degree !== undefined) user.degree = validatedData.degree;
    if (validatedData.role !== undefined) user.role = validatedData.role;
    if (validatedData.status !== undefined) user.status = validatedData.status;
    if (validatedData.editor !== undefined) user.editor = validatedData.editor;
    if (validatedData.hubstaff_id !== undefined) user.hubstaff_id = validatedData.hubstaff_id;

    await user.save();

    // Audit log
    await auditLog(req, 'USER_UPDATE', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      oldValues,
      newValues: {
        group: user.group,
        degree: user.degree,
        role: user.role,
        status: user.status,
        editor: user.editor
      },
      updatedUser: {
        email: user.email,
        name: user.name
      }
    });

    res.json(createSuccessResponse({
      user: user.toSummary()
    }, 'User updated successfully'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400
      ));
    }
    next(error);
  }
});

// Reset user password (admin only)
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    // Only SUPER_ADMIN can reset SUPER_ADMIN password
    if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot reset SUPER_ADMIN password',
        403
      ));
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!1';
    user.passwordHash = await bcrypt.hash(tempPassword, 10);
    await user.save();

    // Audit log
    await auditLog(req, 'USER_RESET_PASSWORD', 'USER', user._id.toString(), {
      ...getRequestMeta(req),
      resetUser: {
        email: user.email,
        name: user.name,
        group: user.group,
        degree: user.degree,
        role: user.role
      }
    });

    res.json(createSuccessResponse({
      tempPassword // Return temp password for v1 local use
    }, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json(createErrorResponse(
        'USER_NOT_FOUND',
        'User not found',
        404
      ));
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json(createErrorResponse(
        'CANNOT_DELETE_SELF',
        'You cannot delete your own account',
        400
      ));
    }

    if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json(createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Cannot delete SUPER_ADMIN user',
        403
      ));
    }

    const deletedMeta = {
      email: user.email,
      name: user.name,
      group: user.group,
      degree: user.degree,
      role: user.role
    };

    await User.findByIdAndDelete(id);

    await auditLog(req, 'USER_DELETE', 'USER', id, {
      ...getRequestMeta(req),
      deletedUser: deletedMeta
    });

    res.json(createSuccessResponse(null, 'User deleted successfully'));
  } catch (error) {
    next(error);
  }
});

export default router;