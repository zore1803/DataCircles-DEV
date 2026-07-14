const Subscription = require('../models/Subscription');
const PlanConfig = require('../models/PlanConfig');
const ContactFields = require('../models/ContactFields');
const CompanyFields = require('../models/CompanyFields');
const DealFields = require('../models/DealFields');
const VendorFields = require('../models/VendorFields');

const checkCustomFieldLimit = async (moduleName, newFields, userId, organizationId) => {
  try {
    const subscription = await Subscription.findOne({ organization: organizationId });
    if (!subscription) {
      return { allowed: false, error: 'No active subscription found' };
    }

    const plan = await PlanConfig.findOne({ planId: subscription.planName });
    if (!plan) {
      return { allowed: false, error: 'Plan configuration not found' };
    }

    const customFieldLimit = plan.features.customFields;

    const modelMap = {
      contactFields: ContactFields,
      companyFields: CompanyFields,
      dealFields: DealFields,
      vendorFields: VendorFields,
    };

    const FieldModel = modelMap[moduleName];
    const fieldsDoc = await FieldModel.findOne({ organization: organizationId });

    // Count existing fields by this user
    let currentUserFieldCount = 0;
    if (fieldsDoc?.fields) {
      currentUserFieldCount = fieldsDoc.fields.filter(
        field => field.createdBy?.toString() === userId.toString()
      ).length;
    }

    // Count new fields being added
    const newFieldsByUser = newFields.filter(
      field => field.createdBy?.toString() === userId.toString()
    ).length;

    const totalAfterAdd = currentUserFieldCount + newFieldsByUser;
    
    if (totalAfterAdd > customFieldLimit) {
      return {
        allowed: false,
        error: `Custom field limit exceeded. You have ${currentUserFieldCount}/${customFieldLimit} fields. Adding ${newFieldsByUser} more would exceed your plan limit.`,
        currentCount: currentUserFieldCount,
        limit: customFieldLimit,
      };
    }

    return { allowed: true, currentCount: currentUserFieldCount, limit: customFieldLimit };
  } catch (error) {
    console.error('Error checking custom field limit:', error);
    return { allowed: false, error: 'Internal error checking field limits' };
  }
};

module.exports = { checkCustomFieldLimit };
