const Company = require('../models/Company');
const Contact = require('../models/Contact');
const Deal = require('../models/Deal');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const companyService = require('../services/companyService');

const createCompany = async (req, res) => {
  try {
    const company = await companyService.createCompany(req.user.organization, req.body, {
      actingUserId: req.user._id,
      createdByUserId: req.user._id,
      profilePictureUrl: req.fileLocation,
    });

    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getAllCompanies = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { industry: { $regex: search, $options: "i" } },
        { gstin: { $regex: search, $options: "i" } },
        { website: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { "additionalFields.value": { $regex: search, $options: "i" } },
      ];
    }

    const companies = await Company.find(query)
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCompaniesPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const {
      search,
      industry,
      sortBy = "name",
      sortOrder = "asc",
      advancedFilters,
    } = req.query;

    const query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { industry: { $regex: search, $options: "i" } },
        { gstin: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { website: { $regex: search, $options: "i" } },
        { "additionalFields.value": { $regex: search, $options: "i" } },
      ];
    }

    if (industry) {
      query.industry = industry;
    }

    if (advancedFilters) {
      const parsedFilters = JSON.parse(advancedFilters);
      const andConditions = [];

      // List of fields that exist at the root level of the schema
      const baseFields = ["name", "industry", "address", "website", "gstin"];

      parsedFilters.forEach((filter) => {
        const { column, operator, value } = filter;
        if (!column || !operator) return;

        let condition = {};
        const isBaseField = baseFields.includes(column);

        // Helper to generate the MongoDB operator object
        const getOperatorQuery = (op, val) => {
          switch (op) {
            case "is":
              return val;
            case "is_not":
              return { $ne: val };
            case "contains":
              return { $regex: val, $options: "i" };
            case "not_contains":
              return { $not: { $regex: val, $options: "i" } };
            case "in":
              return {
                $in: Array.isArray(val)
                  ? val
                  : val.split(",").map((v) => v.trim()),
              };
            case "not_in":
              return {
                $nin: Array.isArray(val)
                  ? val
                  : val.split(",").map((v) => v.trim()),
              };
            case "is_empty":
              return { $in: [null, ""] };
            case "is_not_empty":
              return { $nin: [null, ""] };
            default:
              return val;
          }
        };

        const operatorQuery = getOperatorQuery(operator, value);

        if (isBaseField) {
          condition[column] = operatorQuery;
        } else {
          // For custom additionalFields, we use $elemMatch
          if (operator === "is_empty") {
            condition.additionalFields = {
              $not: { $elemMatch: { key: column } },
            };
          } else if (operator === "is_not_empty") {
            condition.additionalFields = { $elemMatch: { key: column } };
          } else {
            condition.additionalFields = {
              $elemMatch: { key: column, value: operatorQuery },
            };
          }
        }
        andConditions.push(condition);
      });

      if (andConditions.length > 0) {
        query.$and = query.$and
          ? [...query.$and, ...andConditions]
          : andConditions;
      }
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [companies, totalCount] = await Promise.all([
      Company.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .populate("user", "name")
        .populate("createdBy", "name")
        .populate("lastUpdatedBy", "name")
        .lean()
        .select("-__v"),
      Company.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      companies,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({
      error: "Failed to fetch companies",
      message: error.message,
    });
  }
};

const getMyCompanies = async (req, res) => {
  try {
    const companies = await Company.find({
      user: req.user.id,
      organization: req.user.organization,
    })
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate("user", "name")
      .populate("createdBy", "name")
      .populate("lastUpdatedBy", "name");

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (err) {
    res.status(404).json({ error: "Company not found" });
  }
};

const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const contacts = await Contact.find({
      company: req.params.id,
      organization: req.user.organization,
    });

    await Promise.all(contacts.map((contact) => contact.deleteOne()));

    await company.deleteOne();

    res.json({ message: "Company deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateCompany = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      const hasEditPermission = req.user.permissions?.some(
        (p) =>
          p.name.toLowerCase() === "company" && p.permission === "read-write",
      );

      if (!hasEditPermission) {
        return res.status(403).json({
          error:
            "Access denied. You do not have read-write permissions for companies.",
        });
      }
    }

    const company = await companyService.updateCompany(req.params.id, req.user.organization, req.body, {
      lastUpdatedByUserId: req.user._id,
      profilePictureUrl: req.fileLocation,
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// controllers/companyController.js

const exportSelectedCompanies = async (req, res) => {
  try {
    const { selectedIds, columns } = req.body;

    if (!selectedIds || selectedIds.length === 0) {
      return res
        .status(400)
        .json({ error: "No companies selected for export" });
    }

    // 1. Fetch ALL selected companies, regardless of pagination
    const companies = await Company.find({
      _id: { $in: selectedIds },
      organization: req.user.organization, // Ensure they only export their own data
    }).lean();

    // 2. Build CSV Header Row
    // columns looks like: [{ key: 'name', label: 'Company Name', isCustomField: false }, ...]
    const headerRow = columns.map(c => `"${c.label}"`).join(",");

    // 3. Build CSV Data Rows
    const dataRows = companies.map(company => {
      return columns.map(c => {
        let val = "";
        
        if (c.isCustomField) {
          // Extract custom field value
          const field = company.additionalFields?.find(f => f.key === c.key);
          val = field ? field.value : "";
        } else {
          // Extract standard field value
          val = company[c.key] || "";
        }
        
        // Escape quotes for CSV format and convert objects/arrays to strings
        if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
        val = String(val).replace(/"/g, '""');
        
        return `"${val}"`;
      }).join(",");
    });

    // 4. Combine into a single CSV string
    const csvContent = [headerRow, ...dataRows].join("\n");

    // 5. Send as a downloadable file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Exported_Companies.csv"');
    res.status(200).send(csvContent);

  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export companies" });
  }
};

const mergeCompanies = async (req, res) => {
  const { primaryId } = req.params;
  const { secondaryId } = req.body;

  try {
    if (primaryId === secondaryId) {
      return res
        .status(400)
        .json({ error: "Cannot merge a company into itself" });
    }

    const primary = await Company.findOne({
      _id: primaryId,
      organization: req.user.organization,
    });
    const secondary = await Company.findOne({
      _id: secondaryId,
      organization: req.user.organization,
    });

    if (!primary || !secondary) {
      return res.status(404).json({ error: "One or both companies not found" });
    }

    // 1. Merge Standard Fields (only if primary is empty)
    const standardFields = [
      "industry",
      "address",
      "website",
      "gstin",
      "profilePicture",
    ];
    standardFields.forEach((field) => {
      if (
        (!primary[field] || primary[field].trim() === "") &&
        secondary[field]
      ) {
        primary[field] = secondary[field];
      }
    });

    // 2. Merge Social Media Fields
    const socialPlatforms = ["twitter", "linkedin", "facebook"];
    socialPlatforms.forEach((platform) => {
      if (
        (!primary.socialMedia[platform] ||
          primary.socialMedia[platform].trim() === "") &&
        secondary.socialMedia[platform]
      ) {
        primary.socialMedia[platform] = secondary.socialMedia[platform];
      }
    });

    // 3. Merge Additional Custom Fields
    if (secondary.additionalFields && secondary.additionalFields.length > 0) {
      const primaryFieldKeys = primary.additionalFields.map((f) => f.key);

      secondary.additionalFields.forEach((secField) => {
        const primFieldIndex = primaryFieldKeys.indexOf(secField.key);

        if (primFieldIndex === -1) {
          // Field doesn't exist in primary, so add it
          primary.additionalFields.push(secField);
        } else {
          // Field exists, check if it's empty
          const primField = primary.additionalFields[primFieldIndex];
          if (
            primField.value === null ||
            primField.value === undefined ||
            primField.value === ""
          ) {
            primField.value = secField.value;
          }
        }
      });
    }

    primary.lastUpdatedBy = req.user._id;

    // Save the merged fields to the primary company
    await primary.save();

    // 4. Reassign related records from Secondary to Primary
    // (Ensure you have imported these models at the top of your file)
    await Contact.updateMany({ company: secondaryId }, { company: primaryId });

    // Uncomment these as you import their models:
    await Deal.updateMany({ company: secondaryId }, { company: primaryId });
    await Meeting.updateMany({ company: secondaryId }, { company: primaryId });
    await Task.updateMany({ company: secondaryId }, { company: primaryId });

    // Reassign subsidiaries if the secondary company had any
    if (secondary.subsidiaries && secondary.subsidiaries.length > 0) {
      await Company.updateMany(
        { parentCompany: secondaryId },
        { parentCompany: primaryId },
      );
      // Filter out duplicates to avoid referencing the same child twice
      const newSubs = secondary.subsidiaries.filter(
        (subId) =>
          !primary.subsidiaries.includes(subId) &&
          subId.toString() !== primaryId,
      );
      primary.subsidiaries.push(...newSubs);
      await primary.save();
    }

    // 5. Delete the secondary company
    await secondary.deleteOne();

    res.json({ message: "Companies merged successfully", company: primary });
  } catch (error) {
    console.error("Merge error:", error);
    res.status(500).json({ error: "Failed to merge companies" });
  }
};

// Add existing company as subsidiary (child)
const addSubsidiary = async (req, res) => {
  const { id } = req.params;               // parent company ID
  const { subsidiaryId } = req.body;       // child company ID to link

  try {
    // 1. Validate both companies exist
    const parent = await Company.findById(id);
    const child = await Company.findById(subsidiaryId);

    if (!parent || !child) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (parent.organization.toString() !== child.organization.toString()) {
      return res.status(403).json({ message: "Companies must belong to the same organization" });
    }

    // 2. Prevent self-reference and cycles (simple check)
    if (id === subsidiaryId) {
      return res.status(400).json({ message: "Cannot add a company as its own subsidiary" });
    }

    // 3. Check if already a subsidiary
    if (parent.subsidiaries.includes(subsidiaryId)) {
      return res.status(400).json({ message: "Already a subsidiary" });
    }

    // 4. Remove any existing parent from child (only one parent allowed)
    if (child.parentCompany) {
      await Company.findByIdAndUpdate(child.parentCompany, {
        $pull: { subsidiaries: subsidiaryId },
      });
    }

    // 5. Link: set child's parent + add to parent's subsidiaries
    await Company.findByIdAndUpdate(subsidiaryId, {
      parentCompany: id,
      lastUpdatedBy: req.user._id
    });

    await Company.findByIdAndUpdate(id, {
      $addToSet: { subsidiaries: subsidiaryId },
      lastUpdatedBy: req.user._id
    });

    // 6. Return updated parent with populated subsidiaries
    const updatedParent = await Company.findById(id)
      .populate('subsidiaries', 'name industry website');

    res.status(200).json({
      message: "Subsidiary added successfully",
      parent: updatedParent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove subsidiary link
const removeSubsidiary = async (req, res) => {
  const { id, subsidiaryId } = req.params;

  try {
    const parent = await Company.findById(id);
    if (!parent) return res.status(404).json({ message: "Parent company not found" });

    // Remove from parent's subsidiaries array
    await Company.findByIdAndUpdate(id, {
      $pull: { subsidiaries: subsidiaryId },
      lastUpdatedBy: req.user._id,
    });

    // Clear child's parent reference
    await Company.findByIdAndUpdate(subsidiaryId, {
      $unset: { parentCompany: "" },
      lastUpdatedBy: req.user._id,
    });

    res.status(200).json({ message: "Subsidiary removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all subsidiaries of a company
const getSubsidiaries = async (req, res) => {
  const { id } = req.params;

  try {
    const company = await Company.findById(id)
      .populate('subsidiaries', 'name industry website address profilePicture');

    if (!company) return res.status(404).json({ message: "Company not found" });

    res.status(200).json(company.subsidiaries);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getParentCompany = async (req, res) => {
  const { id } = req.params;

  try {
    const company = await Company.findById(id)
      .populate('parentCompany', 'name industry website');

    if (!company) return res.status(404).json({ message: "Company not found" });

    res.status(200).json(company.parentCompany || null);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
  createCompany,
  getAllCompanies,
  getCompanyById,
  deleteCompany,
  getMyCompanies,
  updateCompany,
  getAllCompaniesPaginated,
  exportSelectedCompanies,
  mergeCompanies,
  addSubsidiary,
  removeSubsidiary,
  getSubsidiaries,
  getParentCompany,
};
