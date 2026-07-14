// controllers/couponController.js
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const { validateAndPriceCoupon, evaluateOrderEligibility } = require('../utils/discountEngine');

// ── Super Admin CRUD ─────────────────────────────────────────────────────

const getCoupons = async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (status === 'active') {
      filter.isActive = true;
      filter.$or = [{ 'validity.expiryDate': null }, { 'validity.expiryDate': { $gte: new Date() } }];
    } else if (status === 'expired') {
      filter['validity.expiryDate'] = { $lt: new Date() };
    } else if (status === 'disabled') {
      filter.isActive = false;
    }

    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      filter.$and = [...(filter.$and || []), { $or: [{ code: re }, { name: re }] }];
    }

    const coupons = await Coupon.find(filter)
      .populate('scope.organizations', 'name')
      .sort({ createdAt: -1 });

    res.json({ coupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
};

const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId).populate('scope.organizations', 'name');
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    const redemptions = await CouponRedemption.find({ coupon: coupon._id })
      .populate('organization', 'name')
      .sort({ redeemedAt: -1 })
      .limit(50);

    res.json({ coupon, redemptions });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
};

// Validates the per-product rules array: each entry must name a real
// product (plan/addon), a discount type, and a sane value. Returns an error
// string, or null if the rules are well-formed.
function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return 'At least one product discount rule is required.';
  }
  for (const r of rules) {
    if (!['plan', 'addon'].includes(r.productType)) return 'Each rule needs a valid productType (plan or addon).';
    if (!r.productKey) return 'Each rule needs a productKey.';
    if (!['percentage', 'fixed'].includes(r.discountType)) return `Rule for "${r.productKey}" needs discountType percentage or fixed.`;
    if (r.discountValue == null || r.discountValue < 0) return `Rule for "${r.productKey}" needs a non-negative discountValue.`;
    if (r.discountType === 'percentage' && r.discountValue > 100) return `Rule for "${r.productKey}" cannot exceed 100%.`;
  }
  return null;
}

// Only 'lifetime' and 'until_cancelled' are actually enforceable today — the
// discount is baked into a fixed-price recurring Razorpay Plan at signup and
// never revisited. 'first_payment'/'fixed_cycles'/'until_date' would need an
// auto-revert-after-N-cycles mechanism that doesn't exist yet (see the note
// on Coupon.duration in the model). Rejecting these explicitly at creation
// time is safer than silently treating them as 'lifetime' when the chosen
// label promises something the system doesn't actually do.
const ENFORCEABLE_DURATIONS = ['lifetime', 'until_cancelled'];
function validateDuration(duration) {
  const type = duration?.type || 'lifetime';
  if (!ENFORCEABLE_DURATIONS.includes(type)) {
    return `Duration "${type}" isn't supported yet — the system can't auto-revert a subscription's price after a set number of cycles or a specific date. Use "Lifetime" or "Until cancelled" for now.`;
  }
  return null;
}

const createCoupon = async (req, res) => {
  try {
    const { code, name, description, scope, rules, eligibility, validity, usageLimits, isActive, duration } = req.body;

    if (!code || !code.trim()) return res.status(400).json({ error: 'Coupon code is required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Coupon name is required' });

    const rulesError = validateRules(rules);
    if (rulesError) return res.status(400).json({ error: rulesError });

    const durationError = validateDuration(duration);
    if (durationError) return res.status(400).json({ error: durationError });

    const existing = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (existing) return res.status(400).json({ error: 'A coupon with this code already exists' });

    const coupon = await Coupon.create({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description || '',
      isActive: isActive ?? true,
      scope: {
        type: scope?.type === 'organizations' ? 'organizations' : 'global',
        organizations: scope?.type === 'organizations' ? (scope.organizations || []) : [],
      },
      rules: rules.map((r) => ({
        productType: r.productType,
        productKey: r.productKey,
        discountType: r.discountType,
        discountValue: r.discountValue,
      })),
      eligibility: {
        billingCycle: eligibility?.billingCycle || 'both',
      },
      duration: {
        type: duration?.type || 'lifetime',
        cycles: duration?.cycles ?? null,
      },
      validity: {
        startDate: validity?.startDate || null,
        expiryDate: validity?.expiryDate || null,
      },
      usageLimits: {
        maxRedemptions: usageLimits?.maxRedemptions ?? null,
        maxRedemptionsPerOrganization: usageLimits?.maxRedemptionsPerOrganization ?? null,
      },
      createdBy: req.superAdmin?._id,
    });

    res.status(201).json({ coupon });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    const { name, description, scope, rules, eligibility, validity, usageLimits, isActive, duration } = req.body;

    if (name !== undefined) coupon.name = name.trim();
    if (description !== undefined) coupon.description = description;
    if (isActive !== undefined) coupon.isActive = isActive;

    if (rules !== undefined) {
      const rulesError = validateRules(rules);
      if (rulesError) return res.status(400).json({ error: rulesError });
      coupon.rules = rules.map((r) => ({
        productType: r.productType,
        productKey: r.productKey,
        discountType: r.discountType,
        discountValue: r.discountValue,
      }));
    }

    if (duration !== undefined) {
      const durationError = validateDuration(duration);
      if (durationError) return res.status(400).json({ error: durationError });
      coupon.duration = { type: duration.type || 'lifetime', cycles: duration.cycles ?? null };
    }

    if (scope !== undefined) {
      coupon.scope = {
        type: scope.type === 'organizations' ? 'organizations' : 'global',
        organizations: scope.type === 'organizations' ? (scope.organizations || []) : [],
      };
    }
    if (eligibility !== undefined) {
      coupon.eligibility = {
        billingCycle: eligibility.billingCycle || 'both',
      };
    }
    if (validity !== undefined) {
      coupon.validity = {
        startDate: validity.startDate || null,
        expiryDate: validity.expiryDate || null,
      };
    }
    if (usageLimits !== undefined) {
      coupon.usageLimits = {
        maxRedemptions: usageLimits.maxRedemptions ?? null,
        maxRedemptionsPerOrganization: usageLimits.maxRedemptionsPerOrganization ?? null,
      };
    }

    await coupon.save();
    res.json({ coupon });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
};

// Enable/disable is just a PATCH-style shortcut on top of updateCoupon's isActive
// handling — kept separate because the admin list view triggers it as a single
// toggle action, not a full edit form submission.
const toggleCouponStatus = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({ coupon });
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.status(500).json({ error: 'Failed to update coupon status' });
  }
};

// Archive rather than hard-delete once a coupon has redemption history, so
// CouponRedemption rows (and past invoices referencing the code) stay valid.
const ARCHIVED_SUFFIX = /-ARCHIVED-\d+$/;

const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    const alreadyArchived = ARCHIVED_SUFFIX.test(coupon.code);
    const redemptionCount = await CouponRedemption.countDocuments({ coupon: coupon._id });

    // First delete of a coupon WITH redemption history → soft-archive so the
    // code frees up for reuse but the doc lingers for reference. Deleting an
    // ALREADY-archived coupon (or one with no history) → hard delete. Never
    // re-append the suffix, which previously stacked
    // "-ARCHIVED-...-ARCHIVED-..." on every click. Redemption history survives
    // regardless because CouponRedemption.couponCode is denormalized.
    if (redemptionCount > 0 && !alreadyArchived) {
      coupon.isActive = false;
      coupon.code = `${coupon.code}-ARCHIVED-${Date.now()}`;
      await coupon.save();
      return res.json({ archived: true, message: 'Coupon has redemption history — archived instead of deleted.' });
    }

    await coupon.deleteOne();
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
};

// Search box behind "Selected Organizations" — reuses the same organization
// list already exposed for the billing filter dropdown.
const searchOrganizations = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search && search.trim() ? { name: new RegExp(search.trim(), 'i') } : {};
    const organizations = await Organization.find(filter).select('_id name').sort({ name: 1 }).limit(50).lean();
    res.json({ organizations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search organizations' });
  }
};

// ── Org-facing checkout endpoint ─────────────────────────────────────────

// Validates a coupon against the org's checkout context WITHOUT redeeming it —
// used to show the discount preview before payment. Actual redemption is
// recorded by the billing controller once payment is captured, via
// discountEngine.recordRedemption, so an abandoned checkout never consumes
// usage limits.
// lineItems: [{ key, type: 'plan'|'addon', amount }] — the caller (checkout
// UI) is responsible for breaking the order into its constituent priced
// parts so the engine can discount only the eligible ones.
const validateCoupon = async (req, res) => {
  try {
    const { code, planId, billingCycle, lineItems } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'lineItems is required to price the discount' });
    }

    const organizationId = req.user.organization;
    const result = await validateAndPriceCoupon(code, {
      organizationId,
      planId,
      billingCycle,
      lineItems,
    });

    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.reason });
    }

    res.json({
      valid: true,
      code: result.coupon.code,
      name: result.coupon.name,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      lineItems: result.lineItems,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};

// Order-level validation only (active/dates/org-scope/billing-cycle/usage),
// returning the coupon's per-product rules so the plans page can preview the
// discount on every plan and add-on card BEFORE the customer picks anything.
// No line items, so nothing is priced here — the cards compute their own
// per-product discount from `rules`, and checkout re-prices against the
// actual selection. This is a preview, never a redemption.
const previewCoupon = async (req, res) => {
  try {
    const { code, billingCycle } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code is required' });

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
    if (!coupon) return res.status(400).json({ valid: false, error: 'Coupon not found.' });

    const result = await evaluateOrderEligibility(coupon, {
      organizationId: req.user.organization,
      billingCycle,
    });
    if (!result.valid) return res.status(400).json({ valid: false, error: result.reason });

    res.json({
      valid: true,
      code: coupon.code,
      name: coupon.name,
      rules: coupon.rules || [],
    });
  } catch (error) {
    console.error('Preview coupon error:', error);
    res.status(500).json({ error: 'Failed to preview coupon' });
  }
};

module.exports = {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  searchOrganizations,
  validateCoupon,
  previewCoupon,
};
