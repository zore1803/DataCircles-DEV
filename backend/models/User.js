// models/User.js
const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    permission: {
      type: String,
      enum: ["readonly", "read-write"],
      required: true,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    auth0Id: {
      type: String,
      sparse: true,
      unique: true,
      // Remove default: null to prevent explicit nulls
    },
    name: String,
    email: {
      type: String,
      sparse: true,
      unique: true,
      // Remove default: null to prevent explicit nulls
    },
    password: { 
      type: String, 
      required: function () {
        return !this.auth0Id;
    }
    },
    profileEmail: {
      type: String,
      sparse: true,
      unique: true,
      // Remove default: null to prevent explicit nulls
    },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      // Remove default: null to prevent explicit nulls
    },
    role: { type: String, enum: ["admin", "staff"], default: "staff" },
    profileUrl: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    onboardingIntent: {
      usage: String,
      mainGoal: String,
      source: String,
    },
    // Onboarding Progress Tracker
    onboarding: {
      isCompleted: {
        type: Boolean,
        default: false,
      },
      currentStep: {
        type: Number,
        default: 1,
      },
    },
    // User Data Container (Future-Proof)
    userData: {
      onboardingData: {
        personalInfo: {
          firstName: { type: String },
          lastName: { type: String },
        },
        workspaceInfo: {
          workspaceName: { type: String },
          address: { type: String },
          state: { type: String },
          role: { type: String },
        },
        preferences: {
          useCases: [{ type: String }],
          priorities: [{ type: String }],
          teamType: [{ type: String }],
        },
      },
      mainData: {
        bio: { type: String },
        profilePic: { type: String },
      },
      futureData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    permissions: [permissionSchema],
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true },
);

// Explicitly create indexes
// userSchema.index({ auth0Id: 1 }, { unique: true, sparse: true });
// userSchema.index({ email: 1 }, { unique: true, sparse: true });
// userSchema.index({ profileEmail: 1 }, { unique: true, sparse: true });
// userSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
