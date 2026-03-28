import mongoose from 'mongoose';

/**
 * Group model - managed by super admin in user management.
 * Users are assigned to groups. Groups are used for:
 * - Finance: filter/summarize by group
 * - Reports: group boss/members see only their group
 * - Profile, Job board, Task: group-scoped access
 */
const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

groupSchema.index({ sortOrder: 1 });

export default mongoose.model('Group', groupSchema);
