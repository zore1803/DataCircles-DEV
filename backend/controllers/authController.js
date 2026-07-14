const User = require("../models/User");
const Invited = require("../models/Invited");
const Organization = require("../models/Organization");
const Branding = require("../models/Branding");
const Subscription = require("../models/Subscription");
const PlanConfig = require("../models/PlanConfig");
const SubscriptionPayment = require("../models/SubscriptionPayment.js");
const KanbanBoard = require("../models/KanbanBoard");
const BankDetails = require("../models/BankDetails");
const generateUniqueCode = require("../utils/generateUniqueCode");
const sendMail = require("../utils/sendMail");
const { logUserAction } = require("../utils/logger");
const razorpay = require("../config/razorpay");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const mongoose = require("mongoose");
const sendGridMail = require("../utils/sendGridMail.js");
const bcrypt = require("bcrypt");
const { getSeatStatus, calculateAddonProration } = require('../utils/addonManagement');
const { computeGST } = require('../utils/pricingEngine');
const PlanAddon = require("../models/PlanAddon");

// TempOTP Model Definition
const TempOTP = mongoose.model(
  "TempOTP",
  new mongoose.Schema({
    phone: { type: String, required: true },
    otp: { type: String, required: true },
    expires: { type: Date, required: true },
  }),
);

// Helper function for generating invite email HTML
const generateInviteEmailHTML = (
  inviteLink,
  organizationName,
  inviterName,
  organizationLogoUrl,
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join ${organizationName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
          
          <!-- Data Circles Header (Brand) -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #000; border-bottom: 1px solid #e2e8f0; min-height: 150px;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width: 200px; height: auto;">
            </td>
          </tr>
          
          <!-- Organization Header (Neutral) -->
          <tr>
            <td style="padding: 5px 40px 15px; text-align: center; background-color: #fff;">
              ${organizationLogoUrl
      ? `
              <div style="background-color: #f6f9fc; border-radius: 8px; padding: 12px; display: inline-block; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <img src="${organizationLogoUrl}" alt="${organizationName}" style="max-width: 160px; height: auto;">
              </div>
              `
      : `
              <h2 style="color: #212121; font-size: 22px; font-weight: 600; margin-bottom: 16px; background-color: #f6f9fc; padding: 10px 20px; border-radius: 7px; display: inline-block;">
                ${organizationName}
              </h2>
              `
    }
              <h1 style="color: #23272a; font-size: 26px; font-weight: 600; margin: 0; line-height: 1.2;">
                You're Invited to Join the Team!
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 40px 18px;">
              <p style="color: #23272a; font-size: 16px; line-height: 1.6; margin: 0 0 18px;">
                Hi there,
              </p>
              <p style="color: #23272a; font-size: 16px; line-height: 1.6; margin: 0 0 18px;">
                <strong>${inviterName}</strong> from <strong>${organizationName}</strong> has invited you to join their team on Data Circles CRM. You'll gain access to powerful collaboration tools and be able to work together on managing customer relationships.
              </p>
              <!-- What You'll Get (Neutral Card) -->
              <div style="background-color: #f7f7fa; border-left: 3px solid #d7dbdf; padding: 18px; margin: 22px 0; border-radius: 6px;">
                <h3 style="color: #23272a; font-size: 15px; font-weight: 600; margin: 0 0 9px">
                  What You'll Have Access To:
                </h3>
                <ul style="color: #4a5568; font-size: 14px; line-height: 1.7; margin: 0; padding-left: 18px;">
                  <li style="margin-bottom: 7px;"><strong>${organizationName}</strong>'s contacts, companies, and deals</li>
                  <li style="margin-bottom: 7px;">Shared sales pipelines and team workflows</li>
                  <li style="margin-bottom: 7px;">Real-time collaboration with your colleagues</li>
                  <li>Advanced reporting and analytics tools</li>
                </ul>
              </div>
              
              <!-- CTA Button (Blue Accent) -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 18px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 5px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(102,126,234,0.15);">
                      Accept Invitation & Get Started
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 18px 0 0;">
                New to DataCircles? No problem! You can sign in using your existing Google, Facebook, GitHub, or LinkedIn account, or create an account with your phone number.
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e2e8f0;"></div>
            </td>
          </tr>
          
          <!-- Alternative Link Section -->
          <tr>
            <td style="padding: 24px 40px;">
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 7px;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0;">
                <a href="${inviteLink}" style="color: #667eea; font-size: 13px; word-break: break-all; text-decoration: underline;">
                  ${inviteLink}
                </a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fb; padding: 26px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 10px;">
                This invitation was sent by <strong>${inviterName}</strong> from <strong>${organizationName}</strong>
              </p>
              <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 0 0 7px;">
                Powered by <strong>DataCircles Technology</strong><br>
                © ${new Date().getFullYear()} DataCircles. All rights reserved.
              </p>
              <p style="color: #cbd5e0; font-size: 11px; margin: 0;">
                Questions about DataCircles? <a href="mailto:support@datacircles.in" style="color: #667eea; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Referral invitation email — deliberately mirrors generateInviteEmailHTML's
// structure/branding exactly (same header, CTA, footer), different copy.
// Sending this email creates NO Referral record — a referral only becomes
// Pending when the recipient actually registers using the link (see
// subscriptionController.sendReferralEmail, which calls this and nothing
// else). "Sending an email is not a referral" — see
// backend/docs/REFERRAL_SYSTEM_DESIGN.md.
const generateReferralEmailHTML = (
  referralLink,
  organizationName,
  senderName,
  customMessage,
) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Try DataCircles</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">

          <!-- Data Circles Header (Brand) -->
          <tr>
            <td style="padding: 32px 40px; text-align: center; background-color: #000; border-bottom: 1px solid #e2e8f0; min-height: 150px;">
              <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width: 200px; height: auto;">
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 5px 40px 15px; text-align: center; background-color: #fff;">
              <h2 style="color: #212121; font-size: 22px; font-weight: 600; margin-bottom: 16px; background-color: #f6f9fc; padding: 10px 20px; border-radius: 7px; display: inline-block;">
                ${organizationName}
              </h2>
              <h1 style="color: #23272a; font-size: 26px; font-weight: 600; margin: 0; line-height: 1.2;">
                🎉 You've Been Invited to Try DataCircles
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 40px 18px;">
              <p style="color: #23272a; font-size: 16px; line-height: 1.6; margin: 0 0 18px;">
                Hi there,
              </p>
              <p style="color: #23272a; font-size: 16px; line-height: 1.6; margin: 0 0 18px;">
                <strong>${senderName}</strong> from <strong>${organizationName}</strong> thinks DataCircles CRM could be a great fit for your business.
              </p>
              ${customMessage
      ? `
              <div style="background-color: #f7f7fa; border-left: 3px solid #667eea; padding: 16px 18px; margin: 0 0 18px; border-radius: 6px;">
                <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">"${customMessage}"</p>
              </div>
              `
      : ''
    }
              <!-- Referral reward callout -->
              <div style="background-color: #f7f7fa; border-left: 3px solid #d7dbdf; padding: 18px; margin: 22px 0; border-radius: 6px;">
                <h3 style="color: #23272a; font-size: 15px; font-weight: 600; margin: 0 0 9px">
                  When you sign up and become a paying customer:
                </h3>
                <ul style="color: #4a5568; font-size: 14px; line-height: 1.7; margin: 0; padding-left: 18px;">
                  <li style="margin-bottom: 7px;">✅ You earn a referral reward</li>
                  <li>✅ ${senderName}'s organization also earns a referral reward</li>
                </ul>
              </div>

              <p style="color: #23272a; font-size: 15px; line-height: 1.6; margin: 0 0 8px; font-weight: 600;">
                Start managing:
              </p>
              <ul style="color: #4a5568; font-size: 14px; line-height: 1.7; margin: 0 0 22px; padding-left: 18px;">
                <li>Customers &amp; deals</li>
                <li>Sales pipelines</li>
                <li>Invoices &amp; quotations</li>
                <li>Reports &amp; team collaboration</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 18px;">
                <tr>
                  <td align="center">
                    <a href="${referralLink}" style="background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 5px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(102,126,234,0.15);">
                      Claim Your Reward &amp; Join DataCircles
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 18px 0 0;">
                New to DataCircles? No problem! You can sign in using your existing Google, Facebook, GitHub, or LinkedIn account, or create an account with your phone number.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="border-top: 1px solid #e2e8f0;"></div>
            </td>
          </tr>

          <!-- Alternative Link Section -->
          <tr>
            <td style="padding: 24px 40px;">
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 7px;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0;">
                <a href="${referralLink}" style="color: #667eea; font-size: 13px; word-break: break-all; text-decoration: underline;">
                  ${referralLink}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fb; padding: 26px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 10px;">
                This referral was sent by <strong>${senderName}</strong> from <strong>${organizationName}</strong>
              </p>
              <p style="color: #a0aec0; font-size: 12px; line-height: 1.5; margin: 0 0 7px;">
                Powered by <strong>DataCircles Technology</strong><br>
                © ${new Date().getFullYear()} DataCircles. All rights reserved.
              </p>
              <p style="color: #cbd5e0; font-size: 11px; margin: 0;">
                Questions about DataCircles? <a href="mailto:support@datacircles.in" style="color: #667eea; text-decoration: none;">Contact Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    // Fetch user
    const user = req.user;
    if (req.superAdmin) {
      return res.status(200).json({
        user: req.superAdmin,
        isSuperAdmin: true,
        isTrialActive: false,
        isPaymentConfirmed: true
      });
    } // Fetch subscription for the user's organization
    const subscription = await Subscription.findOne({
      organization: user.organization,
    });
    let isTrialActive = false;
    let trialEnd = null;
    let trialUsed = null;
    let isPaymentConfirmed = false;
    if (subscription) {
      isTrialActive = subscription.isTrialActive;
      trialEnd = subscription.trialEnd;
      trialUsed = subscription.trialUsed;
      isPaymentConfirmed = subscription.isPaymentConfirmed;
    }
    res.status(200).json({
      user,
      isTrialActive,
      trialEnd,
      trialUsed,
      isPaymentConfirmed,
      appStatus: subscription?.appStatus || null,
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (
    !user ||
    user.organization.toString() !== req.user.organization.toString()
  ) {
    return res.status(404).json({ message: "User not found" });
  }
  await logUserAction({
    organization: req.user.organization,
    performedBy: req.user._id,
    action: "user_deleted",
    targetEmail: user.email || user.profileEmail || "unknown",
    targetPermissions: user.permissions || [],
    details: {
      userId: user._id,
      name: user.name,
      role: user.role,
    },
    req,
  });

  await user.deleteOne();
  res.json({ message: "deleted successfully" });
};

// Get all users
exports.getAllUsers = async (req, res) => {
  const allUsers = await User.find(
    { organization: req.user.organization },
    { auth0Id: 0, permissions: 0, role: 0 }, // exclude fields
  );
  res.json({ allUsers });
};

exports.getAllUsersAdmin = async (req, res) => {
  const allUsers = await User.find({ organization: req.user.organization });
  res.json({ allUsers });
};

// Update profile
// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const user = req.user;

    // If a file was uploaded via multer-s3
    if (req.file && req.fileLocation) {
      // Delete old profile picture from S3 if it exists
      if (user.profileUrl && user.profileUrl.includes("cloudfront")) {
        const oldKey = user.profileUrl.split(".net/")[1]; // Extract S3 key from CloudFront URL

        if (oldKey) {
          const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
          const { s3 } = require("../middlewares/uploadMiddlewareS3");

          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: oldKey,
              }),
            );
            console.log(`Deleted old profile picture: ${oldKey}`);
          } catch (error) {
            console.error("Error deleting old profile picture:", error);
            // Don't fail the request if deletion fails
          }
        }
      }

      user.profileUrl = req.fileLocation; // CloudFront URL set by middleware
    }

    await user.save();

    res.json({
      message: "User Profile updated",
      user,
      profileUrl: user.profileUrl,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Get profile
// exports.getProfile = async (req, res) => {
//   const user = req.user;
//   res.json(user.profileUrl);
// };

exports.getProfile = async (req, res) => {
  // Check req.user (regular user) OR req.superAdmin (super admin)
  const user = req.user || req.superAdmin;

  if (!user) {
    return res.status(401).json({ message: "User not found in request" });
  }

  res.json(user.profileUrl || null);
};

// Update permissions
exports.updatePermissions = async (req, res) => {
  const { permissions } = req.body;
  const user = await User.findOne({
    _id: req.params.id,
    organization: req.user.organization,
  });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  user.permissions = permissions;
  await user.save();
  res.json({ message: "Permissions updated", user });
};

// Invite user
exports.inviteUser = async (req, res) => {
  const { email, permissions } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const existingInvite = await Invited.findOne({
      email,
      organization: req.user.organization,
    });
    if (existingInvite) {
      return res.status(400).json({ message: "User already invited" });
    }

    // Fetch subscription and count active users
    const subscription = await Subscription.findOne({
      organization: req.user.organization,
    });

    if (!subscription) {
      return res.status(400).json({
        message:
          "No active subscription found. Please subscribe to a plan first.",
      });
    }

    if (subscription.isTrialActive) {
      return res.status(400).json({
        message:
          "Cannot invite users during trial period. Please upgrade your subscription.",
      });
    }

    // Seat check via addonManagement utility
    const seatStatus = await getSeatStatus(req.user.organization);

    if (seatStatus.hasFreeSeat) {
      // Seats available — proceed immediately
      await logUserAction({
        organization: req.user.organization,
        performedBy: req.user._id,
        action: "invite_sent",
        targetEmail: email,
        targetPermissions: permissions || [],
        details: { seatsAvailable: true, totalSeats: seatStatus.totalSeats },
        req,
      });

      const invite = new Invited({
        email,
        permissions,
        organization: req.user.organization,
        pendingPayment: false,
      });
      await invite.save();

      const inviteLink = `${process.env.FRONTEND_URL}`;
      const org = await Organization.findById(req.user.organization);
      const html = generateInviteEmailHTML(inviteLink, org.name, req.user.name);
      sendGridMail({ to: email, subject: "Invitation to DataCircles CRM", html });

      return res.json({
        message: "User invited successfully",
        seatsUsed: seatStatus.occupiedSeats + 1,
        totalSeats: seatStatus.totalSeats,
      });
    }

    // No free seat — this org needs to buy one more extra_seat add-on.
    // Route through the same intent -> settlement pattern as every other
    // add-on purchase (Order + webhook), instead of charging the saved card
    // synchronously. The invite itself is only created once the webhook
    // settles the payment (see handlePaymentCaptured's add-on-purchase
    // branch in subscriptionController.js).
    const { plan, subscription: seatSubscription } = seatStatus;
    const billingCycle = seatSubscription.billingCycle;

    if (seatSubscription.pendingAddonAddition?.orderId) {
      return res.status(400).json({
        message: "A previous seat purchase is still pending payment. Complete or cancel it first.",
      });
    }

    const catalogEntry = await PlanAddon.findOne({ key: 'extra_seat', isActive: true });
    if (!catalogEntry) {
      return res.status(400).json({
        message: `Extra seat add-on is not configured for the "${plan.planId}" plan. Set it up in Plan Management first.`,
      });
    }
    const pricePerUnit = catalogEntry.price?.[billingCycle];
    if (!pricePerUnit) {
      return res.status(400).json({
        message: `Extra seat pricing is not configured for the "${plan.planId}" plan on the ${billingCycle} cycle.`,
      });
    }

    const prorationAmount = calculateAddonProration(
      1,
      pricePerUnit,
      seatSubscription.currentPeriodStart,
      seatSubscription.currentPeriodEnd
    );
    const prorationAmountWithGST = prorationAmount + computeGST(prorationAmount);

    const razorpayOrder = await razorpay.orders.create({
      amount: prorationAmountWithGST * 100,
      currency: 'INR',
      receipt: `seat_${seatSubscription._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        organization_id: req.user.organization.toString(),
        subscription_id: seatSubscription._id.toString(),
        addon_key: 'extra_seat',
        quantity: '1',
        price_per_unit: pricePerUnit.toString(),
        type: 'addon_purchase',
      },
    });

    seatSubscription.pendingAddonAddition = {
      addonKey: 'extra_seat',
      quantity: 1,
      pricePerUnit,
      prorationAmount: prorationAmountWithGST,
      orderId: razorpayOrder.id,
      createdAt: new Date(),
    };
    await seatSubscription.save();

    // Record intent for this invite — finalized (email sent) only when the
    // webhook settles the matching order.
    await Invited.create({
      email,
      permissions,
      organization: req.user.organization,
      pendingPayment: true,
      pendingSeatOrderId: razorpayOrder.id,
      invitedByName: req.user.name,
    });

    await logUserAction({
      organization: req.user.organization,
      performedBy: req.user._id,
      action: "invite_sent",
      targetEmail: email,
      targetPermissions: permissions || [],
      details: { requiresPayment: true, orderId: razorpayOrder.id },
      req,
    });

    return res.status(402).json({
      message: `No free seat available. An extra seat costs ₹${prorationAmount} (pro-rated for the remaining cycle).`,
      paymentDetails: {
        key: process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: 'INR',
        name: req.user.name,
        description: `Extra seat — pro-rated for remaining cycle`,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || '',
        },
        theme: { color: '#3399cc' },
      },
    });
  } catch (error) {
    console.error("Invite error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.generateInviteEmailHTML = generateInviteEmailHTML;
exports.generateReferralEmailHTML = generateReferralEmailHTML;

// Confirm invite payment
// Get invites
exports.getInvites = async (req, res) => {
  const invites = await Invited.find({ organization: req.user.organization });
  res.json({ invites });
};

// Delete invite
exports.deleteInvite = async (req, res) => {
  const invite = await Invited.findOne({
    _id: req.params.id,
    organization: req.user.organization,
  });
  if (!invite) {
    return res.status(404).json({ message: "Invite not found" });
  }
  await logUserAction({
    organization: req.user.organization,
    performedBy: req.user._id,
    action: "invite_revoked",
    targetEmail: invite.email,
    targetPermissions: invite.permissions || [],
    details: { inviteId: invite._id },
    req,
  });
  await invite.deleteOne();
  res.json({ message: "Invitation revoked" });
};

// Send OTP
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ message: "Phone is required" });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  await TempOTP.deleteMany({ phone });
  const newOtp = new TempOTP({
    phone,
    otp,
    expires: new Date(Date.now() + 10 * 60 * 1000),
  });
  await newOtp.save();

  const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_KEY}&route=dlt&sender_id=DTACRL&message=204838&variables_values=${otp}&flash=0&numbers=${phone}&schedule_time=`;

  try {
    const response = await axios.get(url);
    const data = await response.data;
    if (data.return) {
      res.json({ message: "OTP sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send OTP" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error sending OTP" });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const tempOtp = await TempOTP.findOne({
    phone,
    otp,
    expires: { $gt: new Date() },
  });
  if (!tempOtp) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }
  await tempOtp.deleteOne();

  let user = await User.findOne({ phone });
  const secret = process.env.JWT_SECRET;

  if (user) {
    const token = jwt.sign(
      {
        sub: `phone|${phone}`,
        name: user.name,
        [`${process.env.AUTH0_NAMESPACE}email`]: user.profileEmail,
        [`${process.env.AUTH0_NAMESPACE}name`]: user.name,
      },
      secret,
      { expiresIn: "7d" },
    );
    return res.json({ success: true, token, user });
  } else {
    const tempToken = jwt.sign({ sub: `temp-phone|${phone}` }, secret, {
      expiresIn: "10m",
    });
    return res.status(428).json({
      error: "REGISTRATION_REQUIRED",
      message:
        "Complete registration by providing a company code to join or organization name to create a new one",
      requiresSetup: true,
      tempToken,
      provider: "phone",
    });
  }
};

// ============ EMAIL OTP FUNCTIONS (Separate from Phone OTP) ============
const TempEmailOTP = require("../models/TempEmailOTP");

// Send Email OTP
exports.sendEmailOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTPs for this email
    await TempEmailOTP.deleteMany({ email: email.toLowerCase() });

    // Create new email OTP record
    const newEmailOtp = new TempEmailOTP({
      email: email.toLowerCase(),
      otp,
      verified: false,
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    await newEmailOtp.save();

    // Send OTP via email
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification OTP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f6f9fc;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f6f9fc; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
              
              <!-- Header -->
              <tr>
                <td style="padding: 32px 40px; text-align: center; background-color: #000; border-bottom: 1px solid #e2e8f0; min-height: 150px;">

                  <img src="https://www.datacircles.in/assets/DataCirclesBWLogo.jpg" alt="Data Circles" style="max-width: 200px; height: auto;">
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px;">
                  <h1 style="color: #23272a; font-size: 24px; font-weight: 600; margin: 0 0 16px; text-align: center;">
                    Verify Your Email Address
                  </h1>
                  <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                    Please use the following One-Time Password (OTP) to verify your email address:
                  </p>
                  
                  <!-- OTP Display -->
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${otp}
                    </div>
                  </div>
                  
                  <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                    This OTP will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fb; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0;">
                    Powered by <strong>DataCircles Technology</strong><br>
                    © ${new Date().getFullYear()} DataCircles. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

    console.log(otp, newEmailOtp);
    await sendGridMail({
      to: email,
      subject: "Verify Your Email - Data Circles CRM",
      html: emailHtml,
    });

    console.log(`✅ Email OTP sent to: ${email}`);
    res.json({
      success: true,
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Error sending email OTP:", error);
    res.status(500).json({ message: "Error sending OTP. Please try again." });
  }
};

// Verify Email OTP
exports.verifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    // Find OTP record
    const tempEmailOtp = await TempEmailOTP.findOne({
      email: email.toLowerCase(),
      otp: otp.toString(),
      expires: { $gt: new Date() },
    });

    if (!tempEmailOtp) {
      return res.status(400).json({
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    // Mark as verified (don't delete yet - will be deleted after registration)
    tempEmailOtp.verified = true;
    await tempEmailOtp.save();

    console.log(`✅ Email OTP verified for: ${email}`);
    res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Error verifying email OTP:", error);
    res.status(500).json({ message: "Error verifying OTP. Please try again." });
  }
};

// Complete registration
exports.completeRegistration = async (req, res) => {
  try {
    let sub = req.auth.sub;
    let provider = sub.split("|")[0];
    const namespace = process.env.AUTH0_NAMESPACE;
    let email = req.auth[`${namespace}email`] || req.auth.email || req.body.email;
    let name = req.auth[`${namespace}name`] || req.auth.name || req.body.name || "Unknown";
    let phone;

    if (provider === "temp-phone") {
      provider = "phone";
      phone = sub.split("|")[1];
      email = req.body.email; // profileEmail
      name = req.body.name || "Unknown";
      if (!email) {
        return res.status(400).json({
          error: "EMAIL_REQUIRED",
          message: "Valid email required",
          requiresEmail: true,
          provider: "phone",
          name,
        });
      }

      // ✅ Check if email OTP is verified ONLY when email is being newly provided
      // (not when user is submitting company code/org name in setup form)
      const isProvidingOrgDetails = req.body.code || req.body.orgName;

      if (!isProvidingOrgDetails) {
        // User is in phone profile input form - check email verification
        const emailOtpRecord = await TempEmailOTP.findOne({
          email: email.toLowerCase(),
          verified: true,
          expires: { $gt: new Date() },
        });

        if (!emailOtpRecord) {
          return res.status(400).json({
            error: "EMAIL_NOT_VERIFIED",
            message: "Email not verified. Please verify your email first.",
            requiresEmailVerification: true,
          });
        }

        // Delete the email OTP record after successful verification check
        await TempEmailOTP.deleteMany({ email: email.toLowerCase() });
      }
    }

    // Look up user by auth0Id (sub) first, then by email for non-Facebook/Phone providers, or by phone
    let user = await User.findOne({ auth0Id: sub });
    if (!user && provider !== "facebook" && provider !== "phone" && email) {
  user = await User.findOne({ email });
} else if (!user && provider === "phone") {
      user = await User.findOne({ phone });
    }

    if (user) {
      let updated = false;
      if (!user.auth0Id && provider !== "phone") {
        user.auth0Id = sub;
        updated = true;
      }
      if (provider === "facebook" && email && user.email !== email) {
        const emailTaken = await User.findOne({
          email,
          auth0Id: { $ne: sub },
        });
        if (emailTaken) {
          return res
            .status(400)
            .json({ message: "This email is already registered" });
        }
        user.email = email;
        updated = true;
      }
      if (provider === "phone" && email && user.profileEmail !== email) {
        const emailTaken = await User.findOne({
          profileEmail: email,
          phone: { $ne: phone },
        });
        if (emailTaken) {
          return res
            .status(400)
            .json({ message: "This email is already registered" });
        }
        user.profileEmail = email;
        updated = true;
      }
      if (user.name !== name) {
        user.name = name;
        updated = true;
      }
      if (updated) await user.save();
      const token =
        provider === "phone"
          ? jwt.sign(
            {
              sub: `phone|${user.phone}`,
              name: user.name,
              [`${namespace}email`]: user.profileEmail,
              [`${namespace}name`]: user.name,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" },
          )
          : null;
      return res.json({ success: true, user, token });
    }

    // Check for invited user by email (or profileEmail for phone)
    let organization;
    let role = "staff";
    let permissions = [];
    let joinMethod = null; // Track how the user is joining

    const inviteEmail = provider === "phone" ? email : email;
    const invited = await Invited.findOne({ email: inviteEmail });

    if (invited && invited.pendingPayment) {
      return res.status(402).json({
        message: "Your invite is waiting on a seat purchase to complete. Ask your admin to finish payment, then try again.",
      });
    }

    if (invited) {
      // User was invited - no seat limit check needed as invite already validated seats
      organization = invited.organization;
      permissions = invited.permissions || [];
      joinMethod = "invite";
      await Invited.deleteOne({ _id: invited._id });
    } else if (req.body.code) {
      // User is joining via company code - MUST check seat limits
      const org = await Organization.findOne({ code: req.body.code });
      if (!org) {
        return res.status(400).json({ message: "Invalid company code" });
      }

      // CRITICAL: Check seat limit for code joins
      const subscription = await Subscription.findOne({
        organization: org._id,
      });

      if (subscription) {
        const seatStatus = await getSeatStatus(org._id);

        console.log(
          `Code join attempt - Organization: ${org.name}, Occupied: ${seatStatus.occupiedSeats}, Total seats: ${seatStatus.totalSeats} (${seatStatus.includedSeats} included + ${seatStatus.extraSeatsOwned} extra)`,
        );

        if (!seatStatus.hasFreeSeat) {
          return res.status(403).json({
            message:
              "This organization has reached its user limit. Please contact your admin to purchase more seats.",
            seatsUsed: seatStatus.occupiedSeats,
            totalSeats: seatStatus.totalSeats,
            joinMethod: "code",
          });
        }
      }

      organization = org._id;
      joinMethod = "code";
      permissions = [
        { name: "Companies", permission: "readonly" },
        { name: "Deals", permission: "readonly" },
        { name: "Contacts", permission: "readonly" },
        { name: "Invoices", permission: "readonly" },
        { name: "Tasks", permission: "readonly" },
        { name: "Vendors", permission: "readonly" },
        { name: "purchases", permission: "readonly" },
        { name: "purchase-orders", permission: "readonly" },
        { name: "Items", permission: "readonly" },
        { name: "Meetings", permission: "readonly" },
        { name: "Emails", permission: "readonly" },
        { name: "quotations", permission: "readonly" },
        { name: "delivery-challans", permission: "readonly" },
      ];

      // Generate new code for security
      const newCode = await generateUniqueCode();
      org.code = newCode;
      await org.save();
    } else if (req.body.orgName) {
      // User is creating a new organization
      const code = await generateUniqueCode();
      const org = new Organization({ name: req.body.orgName, code });
      await org.save();
      organization = org._id;
      role = "admin";
      joinMethod = "create";
      permissions = [
        { name: "Companies", permission: "read-write" },
        { name: "Deals", permission: "read-write" },
        { name: "Contacts", permission: "read-write" },
        { name: "Invoices", permission: "read-write" },
        { name: "Tasks", permission: "read-write" },
        { name: "Vendors", permission: "read-write" },
        { name: "purchases", permission: "read-write" },
        { name: "purchase-orders", permission: "read-write" },
        { name: "Items", permission: "read-write" },
        { name: "Meetings", permission: "read-write" },
        { name: "Emails", permission: "read-write" },
        { name: "quotations", permission: "read-write" },
        { name: "delivery-challans", permission: "read-write" },
      ];

      const branding = new Branding();
      branding.companyName = req.body.orgName;
      branding.colors = { primary: "#ffffff", secondary: "#000000" };
      branding.organization = organization;
      await branding.save();

      const kanbanBoard = new KanbanBoard({
        statuses: ["Open", "Won", "Lost"], // Set default statuses explicitly
        organization: organization,
        // Don't set user field since this is organization-wide
      });
      await kanbanBoard.save();
      console.log(
        `KanbanBoard created for new organization: ${req.body.orgName}`,
      );

      // Referral intent — recorded HERE, at organization registration, the
      // business event that means "we know this organization was
      // referred." This is deliberately independent of whether the org
      // ever starts a trial or pays: Pending referrals exist so both sides
      // can already see the referral happened, and neither trial start nor
      // payment should gate that visibility. Never blocks signup on
      // failure. This only ever covers a code captured from a shared link
      // (via localStorage, see App.jsx) — a code typed in manually on the
      // checkout page is applied immediately there instead (see
      // subscriptionController.applyReferralCode), since registration has
      // already completed by the time that field is visible. See
      // backend/docs/REFERRAL_SYSTEM_DESIGN.md §3/§24 and PROJECT_STATE.md §11.
      if (req.body.referralCode) {
        try {
          const { recordReferralIntent } = require('../utils/referralUtils');
          const result = await recordReferralIntent(organization, req.body.referralCode);
          if (!result.created) {
            console.warn(`Referral code not recorded at registration: ${result.reason}`);
          }
        } catch (referralErr) {
          console.error("Failed to record referral intent at registration:", referralErr.message);
        }
      }

      // Seed sample data for new organization
      const seedSampleData = require("../scripts/seedSampleData");
      // await seedSampleData(organization, user._id);  // Note: user is created later, so move this after user.save()
    } else {
      return res.status(400).json({
        message: "Provide company code or organization name",
        requiresSetup: true,
      });
    }

    // Check if profileEmail is already taken (for phone) or email
    if (provider === "phone" && email) {
      const emailTaken = await User.findOne({
        $or: [{ profileEmail: email }, { email }],
      });
      if (emailTaken) {
        return res
          .status(400)
          .json({ message: "This email is already registered" });
      }
    } else if (email) {
      const emailTaken = await User.findOne({
        email,
        auth0Id: { $ne: sub },
      });
      if (emailTaken) {
        return res
          .status(400)
          .json({ message: "This email is already registered" });
      }
    }

    // Create the user
    const userData = {
      name,
      role,
      organization,
      permissions,
    };

    // Only set fields if they have values
    if (provider !== "phone" && sub) {
      userData.auth0Id = sub;
    }
    if (provider !== "phone" && email) {
      userData.email = email;
    }
    if (provider === "phone" && email) {
      userData.profileEmail = email;
    }
    if (provider === "phone" && phone) {
      userData.phone = phone;
    }
    console.log("USER DATA");
    console.log(userData);

    console.log("ORGANIZATION");
    console.log(organization);

    console.log("REQUEST BODY");
    console.log(req.body);

    user = new User(userData);

    await user.save();

    await BankDetails.create({
      contact: {
        email: "contact@organization.com",
        phone: "9999999999",
      },
      bank: "HDFC Bank",
      accountHolder: "Organization Pvt Ltd",
      accountNumber: "1234567890",
      ifscCode: "HDFC0001234",
      branch: "Mumbai",
      organization: organization,
      user: user._id, // null for org default
    });

    // If new organization, seed sample data here (after user is created)
    if (joinMethod === "create") {
      const seedSampleData = require("../scripts/seedSampleData");
      await seedSampleData(organization, user._id);
    }

    console.log(
      `User registered successfully - Method: ${joinMethod}, Email: ${email || phone
      }, Organization: ${organization}`,
    );

    const token =
      provider === "phone"
        ? jwt.sign(
          {
            sub: `phone|${phone}`,
            name,
            [`${namespace}email`]: email,
            [`${namespace}name`]: name,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" },
        )
        : null;

    if (role === "admin") {
      const org = await Organization.findById(organization);
      res.json({ success: true, user, companyCode: org.code, token });
    } else {
      res.json({ success: true, user, token });
    }
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Password Reset - Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });

    // Always return the same generic message to prevent email enumeration
    if (!user) {
      return res.json({ message: "If that email is in our system, we sent a reset link to it." });
    }

    // Auth0, Google, Facebook, and phone users have no local password —
    // they authenticate via their provider and cannot use this reset flow.
    if (!user.password) {
      return res.status(400).json({
        message: "This account uses social or phone sign-in. Please sign in via your original method.",
      });
    }

    // Generate a cryptographically random raw token (sent in the email link)
    // and store only its SHA-256 hash in the DB — raw token never touches the DB.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("Reset link:", resetLink);
    }

    await sendGridMail({
      to: email,
      subject: "Reset your DataCircles password",
      html: `
        <p>Hi ${user.name || "there"},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">Reset my password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
      `,
    });

    res.json({ message: "If that email is in our system, we sent a reset link to it." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Password Reset - Reset Password
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: "Token and new password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  try {
    // Hash the incoming raw token to match what's stored in the DB
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password successfully reset. You can now sign in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Setup Workspace (Onboarding)
exports.setupWorkspace = async (req, res) => {
  try {
    const user = req.user;
    const {
      name,
      firstName,
      lastName,
      email,
      workspaceName,
      workspaceAddress,
      workspaceState,
      usage,
      mainGoal,
      source,
    } = req.body;

    // Update User Profile
    if (name) user.name = name;
    if (email) user.email = email;

    // Update Onboarding Intent (legacy/backward compatibility)
    user.onboardingIntent = {
      usage,
      mainGoal,
      source,
    };

    // Update Onboarding Progress
    user.onboarding.isCompleted = true;
    user.onboarding.currentStep = 3;

    // Update New User Data Structure
    user.userData.onboardingData = {
      personalInfo: {
        firstName: firstName || "",
        lastName: lastName || "",
      },
      workspaceInfo: {
        workspaceName: workspaceName || "",
        address: workspaceAddress || "",
        state: workspaceState || "",
        role: "admin", // Default role for workspace creator
      },
      preferences: {
        useCases: usage ? [usage] : [],
        priorities: mainGoal ? [mainGoal] : [],
        teamType: source ? [source] : [],
      },
    };

    // Update Organization
    const organization = await Organization.findById(user.organization);
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (workspaceName) organization.name = workspaceName;
    if (workspaceAddress) organization.address = workspaceAddress;
    if (workspaceState) organization.state = workspaceState;

    // Handle Workspace Logo Upload
    if (req.file && req.fileLocation) {
      // Delete old logo if exists (optional logic, similar to profile picture)
      if (organization.logo && organization.logo.includes("cloudfront")) {
        const oldKey = organization.logo.split(".net/")[1];
        if (oldKey) {
          const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
          const { s3 } = require("../middlewares/uploadMiddlewareS3");
          try {
            await s3.send(
              new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: oldKey,
              }),
            );
          } catch (e) {
            console.error("Error deleting old logo", e);
          }
        }
      }
      organization.logo = req.fileLocation;
    }

    await user.save();
    await organization.save();

    res.json({
      success: true,
      message: "Workspace details updated successfully",
      user,
      organization,
    });
  } catch (error) {
    console.error("Setup workspace error:", error);
    res.status(500).json({ error: error.message });
  }
};


/**
 * Login for all user roles
 * POST /api/v1/auth/login
 */

exports.login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;

    // 1. Construct search condition (Mongoose uses direct objects)
    const searchCondition = email ? { email } : { phone };

    // 2. Find user and populate organization if needed
    const user = await User.findOne(searchCondition).populate("organization");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `Invalid ${email ? "email" : "phone number"} or password`,
      });
    }

    // 3. Verify Password 
    // Note: Ensure you add 'password' to your User schema. 
    // If using password_hash from Sequelize, rename field accordingly.
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 4. Role-Based Logic (Adapted for your Mongoose schema)
    // Your schema uses "admin" or "staff". Drivers logic removed/updated:
    if (user.role === "staff" && user.onboarding?.isCompleted === false) {
      // Optional: Example of specific logic for your schema's state
      console.log("User has not finished onboarding");
    }

    // 5. Generate JWT
    const token = jwt.sign(
      {
        user_id: user._id, // Mongoose uses _id
        role: user.role,
        organization: user.organization?._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 6. Prepare Response
    // Convert to object and remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: userResponse
      },
    });
  } catch (error) {
    next(error);
  }
};