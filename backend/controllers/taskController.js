const Task = require("../models/Task");
const User = require("../models/User");
const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const Vendor = require("../models/Vendor");
const sendGridMail = require("../utils/sendGridMail");
const NotificationSettings = require("../models/NotificationSettings");

const createTask = async (req, res) => {
  try {
    let assignedUsers = [];

    if (req.body.users && req.body.users.length > 0) {
      // Verify all assigned users belong to the same organization
      const users = await User.find({
        _id: { $in: req.body.users },
        organization: req.user.organization,
      });

      if (users.length !== req.body.users.length) {
        return res
          .status(400)
          .json({ message: "Some users do not belong to your organization" });
      }

      assignedUsers = req.body.users;
    } else {
      assignedUsers = [req.user.id];
    }

    // Validate relatedEntities array
    if (!req.body.relatedEntities || req.body.relatedEntities.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one related entity is required" });
    }

    // Validate each entity in relatedEntities belongs to the organization
    for (const entity of req.body.relatedEntities) {
      if (!entity.entityId || !entity.entityModel) {
        return res.status(400).json({
          message: "Each related entity must have entityId and entityModel",
        });
      }

      let relatedEntity;
      switch (entity.entityModel) {
        case "Company":
          relatedEntity = await Company.findOne({
            _id: entity.entityId,
            organization: req.user.organization,
          });
          break;
        case "Contact":
          relatedEntity = await Contact.findOne({
            _id: entity.entityId,
            organization: req.user.organization,
          });
          break;
        case "Deal":
          relatedEntity = await Deal.findOne({
            _id: entity.entityId,
            organization: req.user.organization,
          });
          break;
        case "Vendor":
          relatedEntity = await Vendor.findOne({
            _id: entity.entityId,
            organization: req.user.organization,
          });
          break;
        default:
          return res
            .status(400)
            .json({ message: `Invalid entity model: ${entity.entityModel}` });
      }

      if (!relatedEntity) {
        return res.status(404).json({
          message: `${entity.entityModel} not found in your organization`,
        });
      }
    }

    // Validate Deal and Vendor appear only once
    const entityModels = req.body.relatedEntities.map((e) => e.entityModel);
    const dealCount = entityModels.filter((m) => m === "Deal").length;
    const vendorCount = entityModels.filter((m) => m === "Vendor").length;

    if (dealCount > 1) {
      return res
        .status(400)
        .json({ message: "Only one Deal can be associated with a task" });
    }
    if (vendorCount > 1) {
      return res
        .status(400)
        .json({ message: "Only one Vendor can be associated with a task" });
    }

    const normalizeDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
      );
    };

    const taskData = {
      ...req.body,
      dueDate: normalizeDate(req.body.dueDate),
      selectedDate: normalizeDate(req.body.selectedDate),
      users: assignedUsers,
      createdBy: req.user.id,
      organization: req.user.organization,
    };

    const task = await Task.create(taskData);

    // Populate the relatedEntities
    await task.populate("relatedEntities.entityId");
    await task.populate("users", "name email role profileUrl userData.mainData.profilePic");
    await task.populate("createdBy", "name email");

    // Get related entity names for email
    const relatedNames = task.relatedEntities
      .map((e) => {
        const entity = e.entityId;
        const name = entity.name || entity.title || "N/A";
        return `${e.entityModel}: ${name}`;
      })
      .join(", ");

    // Fetch notification settings for assigned users with task notifications enabled
    const notificationUsers = await NotificationSettings.find({
      userId: { $in: assignedUsers },
      organization: req.user.organization,
      tasks: true,
    }).select("userId");

    const notificationUserIds = notificationUsers.map((n) =>
      n.userId.toString()
    );

    // Send emails to assigned users who have task notification enabled
    const usersData = await User.find({ _id: { $in: notificationUserIds } });

    for (const u of usersData) {
      sendGridMail({
        to: u.email,
        subject: "New Task Assigned",
        text: "please complete the task before due date",
        html: `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
    <h2 style="color: #2c3e50;">New Task Assigned</h2>
    <p>Hi ${u.name || ""},</p>
    <p>You have been assigned a new task. Please find the details below:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold; width: 150px;">Title:</td>
        <td style="padding: 8px;">${task.title}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Description:</td>
        <td style="padding: 8px;">${task.description || "N/A"}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Due Date:</td>
        <td style="padding: 8px;">${
          task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "N/A"
        }</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Related To:</td>
        <td style="padding: 8px;">${relatedNames}</td>
      </tr>
    </table>

    <p>Please make sure to complete the task before the due date.</p>
    <p style="margin-top: 30px;">Best regards,<br>Your Team</p>
  </div>
`,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getAllTask = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const tasks = await Task.find(query)
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllTasksPaginated = async (req, res) => {
  try {
    // Pagination
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    // Filters & Sorting
    const {
      search,
      status,
      user,
      dueDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Base query - always filter by organization
    let query = { organization: req.user.organization };

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // User filter (Assigned To)
    if (user) {
      query.users = user; // MongoDB will match if user ID is in the array
    }

    // Due Date filter (exact date match - midnight UTC)
    if (dueDate) {
      const start = new Date(dueDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(dueDate);
      end.setUTCHours(23, 59, 59, 999);

      query.dueDate = { $gte: start, $lte: end };
    }

    // Sorting
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute
    const [tasks, totalCount] = await Promise.all([
      Task.find(query)
        .populate("relatedEntities.entityId")
        .populate("users", "name email role profileUrl userData.mainData.profilePic")
        .populate("createdBy", "name email")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      Task.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      tasks,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({
      error: "Failed to fetch tasks",
      message: err.message,
    });
  }
};

const getMyTask = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {
      users: req.user.id,
      organization: req.user.organization,
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const tasks = await Task.find(query)
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTasksByVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const tasks = await Task.find({
      "relatedEntities.entityId": req.params.id,
      "relatedEntities.entityModel": "Vendor",
      organization: req.user.organization,
    })
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTasksByContact = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const tasks = await Task.find({
      "relatedEntities.entityId": req.params.id,
      "relatedEntities.entityModel": "Contact",
      organization: req.user.organization,
    })
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTasksByCompany = async (req, res) => {
  try {
    const company = await Company.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const tasks = await Task.find({
      "relatedEntities.entityId": req.params.id,
      "relatedEntities.entityModel": "Company",
      organization: req.user.organization,
    })
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTasksByDeal = async (req, res) => {
  try {
    const deal = await Deal.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    const tasks = await Task.find({
      "relatedEntities.entityId": req.params.id,
      "relatedEntities.entityModel": "Deal",
      organization: req.user.organization,
    })
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!task) return res.status(404).json({ message: "Task not found" });

    // Validate new users belong to the organization if provided
    if (req.body.users) {
      const users = await User.find({
        _id: { $in: req.body.users },
        organization: req.user.organization,
      });

      if (users.length !== req.body.users.length) {
        return res
          .status(400)
          .json({ message: "Some users do not belong to your organization" });
      }
    }

    // Validate relatedEntities if provided
    if (req.body.relatedEntities) {
      if (req.body.relatedEntities.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one related entity is required" });
      }

      // Validate each entity
      for (const entity of req.body.relatedEntities) {
        if (!entity.entityId || !entity.entityModel) {
          return res.status(400).json({
            message: "Each related entity must have entityId and entityModel",
          });
        }

        let relatedEntity;
        switch (entity.entityModel) {
          case "Company":
            relatedEntity = await Company.findOne({
              _id: entity.entityId,
              organization: req.user.organization,
            });
            break;
          case "Contact":
            relatedEntity = await Contact.findOne({
              _id: entity.entityId,
              organization: req.user.organization,
            });
            break;
          case "Deal":
            relatedEntity = await Deal.findOne({
              _id: entity.entityId,
              organization: req.user.organization,
            });
            break;
          case "Vendor":
            relatedEntity = await Vendor.findOne({
              _id: entity.entityId,
              organization: req.user.organization,
            });
            break;
          default:
            return res
              .status(400)
              .json({ message: `Invalid entity model: ${entity.entityModel}` });
        }

        if (!relatedEntity) {
          return res.status(404).json({
            message: `${entity.entityModel} not found in your organization`,
          });
        }
      }

      // Validate Deal and Vendor appear only once
      const entityModels = req.body.relatedEntities.map((e) => e.entityModel);
      const dealCount = entityModels.filter((m) => m === "Deal").length;
      const vendorCount = entityModels.filter((m) => m === "Vendor").length;

      if (dealCount > 1) {
        return res
          .status(400)
          .json({ message: "Only one Deal can be associated with a task" });
      }
      if (vendorCount > 1) {
        return res
          .status(400)
          .json({ message: "Only one Vendor can be associated with a task" });
      }
    }

    const prevUsers = task.users.map((u) => u.toString());
    await task.updateOne(req.body);

    // Get updated task with populated fields
    const updatedTask = await Task.findById(req.params.id)
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    // Get related entity names for email
    const relatedNames = updatedTask.relatedEntities
      .map((e) => {
        const entity = e.entityId;
        const name = entity.name || entity.title || "N/A";
        return `${e.entityModel}: ${name}`;
      })
      .join(", ");

    // Send emails to newly assigned users who have task notification enabled
    if (req.body.users) {
      const newUsers = req.body.users.filter((u) => !prevUsers.includes(u));
      if (newUsers.length > 0) {
        const notificationUsers = await NotificationSettings.find({
          userId: { $in: newUsers },
          organization: req.user.organization,
          tasks: true,
        }).select("userId");

        const notificationUserIds = notificationUsers.map((n) =>
          n.userId.toString()
        );
        const usersData = await User.find({
          _id: { $in: notificationUserIds },
        });

        for (const u of usersData) {
          sendGridMail({
            to: u.email,
            subject: "New Task Assigned",
            text: "please complete the task before due date",
            html: `
  <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #eee; border-radius: 6px;">
    <h2 style="color: #2c3e50;">New Task Assigned</h2>
    <p>Hi ${u.name || ""},</p>
    <p>You have been assigned a new task. Please find the details below:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold; width: 150px;">Title:</td>
        <td style="padding: 8px;">${updatedTask.title}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Description:</td>
        <td style="padding: 8px;">${updatedTask.description || "N/A"}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Due Date:</td>
        <td style="padding: 8px;">${
          updatedTask.dueDate
            ? new Date(updatedTask.dueDate).toLocaleDateString()
            : "N/A"
        }</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Related To:</td>
        <td style="padding: 8px;">${relatedNames}</td>
      </tr>
    </table>

    <p>Please make sure to complete the task before the due date.</p>
    <p style="margin-top: 30px;">Best regards,<br>Your Team</p>
  </div>
`,
          });
        }
      }
    }

    res.status(200).json(updatedTask);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ message: err.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Pending", "Completed"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      { status },
      { new: true }
    )
      .populate("relatedEntities.entityId")
      .populate("users", "name email role profileUrl userData.mainData.profilePic")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!task) return res.status(404).json({ message: "Task not found" });

    await task.deleteOne();
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getTasks = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };

    if (req.user.role === "staff") {
      filter = {
        ...filter,
        $or: [
          { users: req.user._id }, // tasks assigned to user
          { createdBy: req.user._id }, // tasks created by user
        ],
      };
    }

    const tasks = await Task.find(filter).populate("users createdBy");

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getDashboardTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organization;
    const isAdmin = req.user.role === "admin";

    let tasks;

    if (isAdmin) {
      // Admin sees ALL TASKS in the organization
      tasks = await Task.find({ organization: organizationId }).populate(
        "assignedTo createdBy company contact deal vendor"
      );
    } else {
      // Staff sees ONLY tasks assigned to him OR created by him
      tasks = await Task.find({
        organization: organizationId,
        $or: [{ assignedTo: userId }, { createdBy: userId }],
      }).populate("assignedTo createdBy company contact deal vendor");
    }

    res.json({ tasks });
  } catch (error) {
    console.error("Dashboard tasks error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard tasks" });
  }
};

module.exports = {
  createTask,
  getAllTask,
  getAllTasksPaginated,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getMyTask,
  getTasksByVendor,
  getTasksByContact,
  getTasksByCompany,
  getTasksByDeal,
  getDashboardTasks,
};
