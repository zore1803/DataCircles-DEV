// models/Notification.js
//
// An activity-feed notification: one record per create / update / delete that
// happens to any tracked model, written automatically by the global
// change-notifier plugin (utils/changeNotifier.js). Distinct from
// NotificationSettings, which stores a user's *email* preferences.

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Who made the change.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,

    action: {
      type: String,
      enum: ["created", "updated", "deleted"],
      required: true,
    },

    // The thing that changed.
    entityType: String, // human label, e.g. "Company", "Deal"
    entityId: mongoose.Schema.Types.ObjectId,
    entityLabel: String, // best-effort display name of the record

    // Field-level diff for updates: [{ field, value }].
    changes: [
      {
        _id: false,
        field: String,
        value: mongoose.Schema.Types.Mixed,
      },
    ],

    // Pre-composed human-readable summary.
    message: String,

    // Users who have opened/seen this notification. Unread = user not in list.
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

notificationSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
