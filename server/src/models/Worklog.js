import mongoose from 'mongoose';

/**
 * Worklog — matches the pre-existing `worklogs` collection shape:
 *   { hubstaff_id, user_id, date (Date), real_time, add_time, total_time,
 *     activities, productivity, note, status, source }
 *
 * One record per user per day. Hours in `real_time` come from Hubstaff sync;
 * `add_time` is added manually by admin via the Workflow page.
 */
const worklogSchema = new mongoose.Schema(
  {
    hubstaff_id: {
      type: String,
      default: null,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    real_time: {
      type: Number,
      default: 0,
      min: 0,
    },
    add_time: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_time: {
      type: Number,
      default: 0,
    },
    activities: {
      type: Number,
      default: 0,
    },
    productivity: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: 'approved',
    },
    source: {
      type: String,
      default: 'manual',
    },
  },
  { timestamps: true }
);

worklogSchema.index({ user_id: 1, date: 1 });
worklogSchema.index({ hubstaff_id: 1, date: 1 });

export default mongoose.model('Worklog', worklogSchema);
