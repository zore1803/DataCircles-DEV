const Meeting = require("../models/Meeting");
const Contact = require("../models/Contact");
const Company = require("../models/Company");
const Vendor = require("../models/Vendor");
const User = require("../models/User");
const sendGridMail = require("../utils/sendGridMail");
const NotificationSettings = require("../models/NotificationSettings");

// controllers/meetingController.js (updated createMeeting)

const MeetingType = require("../models/MeetingType");
const Task = require("../models/Task"); // for follow-up task
const { google } = require("googleapis");
const axios = require("axios");

// Helper function to get meeting participants' emails
const getMeetingParticipants = async (meeting) => {
  const emails = [];

  if (meeting.contact && meeting.contact.email) {
    emails.push(meeting.contact.email);
  }

  // Handle multiple participants
  if (meeting.participants && meeting.participants.length > 0) {
    meeting.participants.forEach((participant) => {
      if (participant.email) {
        emails.push(participant.email);
      }
    });
  }

  if (meeting.createdBy && meeting.createdBy.email) {
    emails.push(meeting.createdBy.email);
  }

  return [...new Set(emails)]; // Remove duplicates
};

// Helper function to format meeting details for email
const formatMeetingDetails = (meeting) => {
  const formatDate = (date) => new Date(date).toLocaleString();
  const entityName =
    meeting.contact?.name ||
    meeting.company?.name ||
    meeting.vendor?.name ||
    "Unknown";
  const entityType =
    meeting.linkedTo.charAt(0).toUpperCase() + meeting.linkedTo.slice(1);
  const participantNames =
    meeting.participants?.map((p) => p.name).join(", ") || "Not assigned";

  return {
    title: meeting.title,
    scheduledAt: formatDate(meeting.scheduledAt),
    duration: `${meeting.duration} minutes`,
    location: meeting.location || "Not specified",
    meetingType: meeting.meetingType,
    entityName,
    entityType,
    participants: participantNames,
    description: meeting.description || "No description provided",
  };
};

// Helper function to generate meeting creation email template
const generateMeetingCreationEmail = (meetingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
        .footer { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Scheduled</h1>
        </div>
        <div class="content">
          <p>A new meeting has been scheduled. Here are the details:</p>
          
          <div class="details">
            <h3>${meetingDetails.title}</h3>
            <p><strong>Date & Time:</strong> ${meetingDetails.scheduledAt}</p>
            <p><strong>Duration:</strong> ${meetingDetails.duration}</p>
            <p><strong>Location:</strong> ${meetingDetails.location}</p>
            <p><strong>Type:</strong> ${meetingDetails.meetingType}</p>
            <p><strong>Related ${meetingDetails.entityType}:</strong> ${meetingDetails.entityName}</p>
            <p><strong>Participants:</strong> ${meetingDetails.participants}</p>
            <p><strong>Description:</strong> ${meetingDetails.description}</p>
          </div>
          
          <p>Please make sure to mark this in your calendar and prepare accordingly.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from your CRM system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Meeting Scheduled: ${meetingDetails.title}
    
    Date & Time: ${meetingDetails.scheduledAt}
    Duration: ${meetingDetails.duration}
    Location: ${meetingDetails.location}
    Type: ${meetingDetails.meetingType}
    Related ${meetingDetails.entityType}: ${meetingDetails.entityName}
    Participants: ${meetingDetails.participants}
    Description: ${meetingDetails.description}
    
    Please make sure to mark this in your calendar and prepare accordingly.
  `;

  return { html, text };
};

// Helper function to generate meeting update email template
const generateMeetingUpdateEmail = (meetingDetails, changes) => {
  const changesHtml = Object.entries(changes)
    .map(
      ([key, { from, to }]) =>
        `<li><strong>${key}:</strong> ${from} → ${to}</li>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #FF9800; }
        .changes { background-color: #FFF3E0; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Updated</h1>
        </div>
        <div class="content">
          <p>The following meeting has been updated:</p>
          
          <div class="details">
            <h3>${meetingDetails.title}</h3>
            <p><strong>Date & Time:</strong> ${meetingDetails.scheduledAt}</p>
            <p><strong>Duration:</strong> ${meetingDetails.duration}</p>
            <p><strong>Location:</strong> ${meetingDetails.location}</p>
          </div>
          
          <div class="changes">
            <h4>Changes Made:</h4>
            <ul>${changesHtml}</ul>
          </div>
          
          <p>Please update your calendar accordingly.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from your CRM system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const changesText = Object.entries(changes)
    .map(([key, { from, to }]) => `${key}: ${from} → ${to}`)
    .join("\n");

  const text = `
    Meeting Updated: ${meetingDetails.title}
    
    Current Details:
    Date & Time: ${meetingDetails.scheduledAt}
    Duration: ${meetingDetails.duration}
    Location: ${meetingDetails.location}
    
    Changes Made:
    ${changesText}
    
    Please update your calendar accordingly.
  `;

  return { html, text };
};

// Helper function to generate meeting reminder email template
const generateMeetingReminderEmail = (meetingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
        .reminder { background-color: #E3F2FD; padding: 15px; margin: 10px 0; border-radius: 5px; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Reminder</h1>
        </div>
        <div class="content">
          <div class="reminder">
            <h2>⏰ Your meeting starts in 1 hour!</h2>
          </div>
          
          <div class="details">
            <h3>${meetingDetails.title}</h3>
            <p><strong>Date & Time:</strong> ${meetingDetails.scheduledAt}</p>
            <p><strong>Duration:</strong> ${meetingDetails.duration}</p>
            <p><strong>Location:</strong> ${meetingDetails.location}</p>
            <p><strong>Type:</strong> ${meetingDetails.meetingType}</p>
            <p><strong>Description:</strong> ${meetingDetails.description}</p>
          </div>
          
          <p>Don't forget to prepare any materials you might need for this meeting.</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from your CRM system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Meeting Reminder - Starting in 1 hour!
    
    ${meetingDetails.title}
    Date & Time: ${meetingDetails.scheduledAt}
    Duration: ${meetingDetails.duration}
    Location: ${meetingDetails.location}
    Type: ${meetingDetails.meetingType}
    Description: ${meetingDetails.description}
    
    Don't forget to prepare any materials you might need for this meeting.
  `;

  return { html, text };
};

// Helper function to generate meeting cancellation email template
const generateMeetingCancellationEmail = (meetingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #F44336; }
        .footer { text-align: center; padding: 20px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Cancelled</h1>
        </div>
        <div class="content">
          <p>The following meeting has been cancelled:</p>
          
          <div class="details">
            <h3>${meetingDetails.title}</h3>
            <p><strong>Was scheduled for:</strong> ${meetingDetails.scheduledAt}</p>
            <p><strong>Duration:</strong> ${meetingDetails.duration}</p>
            <p><strong>Location:</strong> ${meetingDetails.location}</p>
          </div>
          
          <p>Please remove this meeting from your calendar. We apologize for any inconvenience.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from your CRM system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Meeting Cancelled: ${meetingDetails.title}
    
    Was scheduled for: ${meetingDetails.scheduledAt}
    Duration: ${meetingDetails.duration}
    Location: ${meetingDetails.location}
    
    Please remove this meeting from your calendar. We apologize for any inconvenience.
  `;

  return { html, text };
};

// Create a new meeting
exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      scheduledAt,
      duration,
      priority,
      meetingType,
      location,
      linkedTo,
      contactId,
      companyId,
      vendorId,
      participants,
    } = req.body;

    // Add the normalizeDate function (same as in createTask)
    const normalizeDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
      );
    };

    // Validate required fields based on linkedTo type
    if (linkedTo === "contact" && !contactId) {
      return res
        .status(400)
        .json({ error: "Contact ID is required for contact meetings" });
    }
    if (
      linkedTo === "company" &&
      (!companyId || !participants || participants.length === 0)
    ) {
      return res.status(400).json({
        error:
          "Company ID and at least one participant are required for company meetings",
      });
    }
    if (linkedTo === "vendor" && !vendorId) {
      return res
        .status(400)
        .json({ error: "Vendor ID is required for vendor meetings" });
    }

    // Verify the linked entity exists within the organization
    let linkedEntity;
    if (linkedTo === "contact") {
      linkedEntity = await Contact.findOne({
        _id: contactId,
        organization: req.user.organization,
      });
      if (!linkedEntity) {
        return res
          .status(404)
          .json({ error: "Contact not found in your organization" });
      }
    } else if (linkedTo === "company") {
      linkedEntity = await Company.findOne({
        _id: companyId,
        organization: req.user.organization,
      });
      if (!linkedEntity) {
        return res
          .status(404)
          .json({ error: "Company not found in your organization" });
      }
      // Verify all participants exist within the organization
      const participantUsers = await Contact.find({
        _id: { $in: participants },
        organization: req.user.organization,
      });
      if (participantUsers.length !== participants.length) {
        return res.status(404).json({
          error: "One or more participants not found in your organization",
        });
      }
    } else if (linkedTo === "vendor") {
      linkedEntity = await Vendor.findOne({
        _id: vendorId,
        organization: req.user.organization,
      });
      if (!linkedEntity) {
        return res
          .status(404)
          .json({ error: "Vendor not found in your organization" });
      }
    }

    const meetingData = {
      title,
      description,
      scheduledAt: normalizeDate(scheduledAt), // ✅ Apply normalization here
      duration: duration || 60,
      priority: priority || "medium",
      meetingType: meetingType || "in-person",
      location,
      linkedTo,
      createdBy: req.user.id,
      organization: req.user.organization,
    };

    // Add the appropriate reference based on linkedTo type
    if (linkedTo === "contact") {
      meetingData.contact = contactId;
    } else if (linkedTo === "company") {
      meetingData.company = companyId;
      meetingData.participants = participants;
    } else if (linkedTo === "vendor") {
      meetingData.vendor = vendorId;
    }

    const meeting = new Meeting(meetingData);
    await meeting.save();

    // Populate the meeting with related data
    await meeting.populate([
      { path: "contact", select: "name email phone" },
      { path: "company", select: "name industry" },
      { path: "vendor", select: "name email" },
      { path: "participants", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    // Gather participant IDs for notification settings check
    const participantIds = [];
    if (meeting.createdBy && meeting.createdBy._id)
      participantIds.push(meeting.createdBy._id);
    if (meeting.contact && meeting.contact._id)
      participantIds.push(meeting.contact._id);
    if (meeting.participants && meeting.participants.length > 0) {
      meeting.participants.forEach((p) => participantIds.push(p._id));
    }

    // Fetch notification settings for meeting participants with meeting notifications enabled
    const notificationUsers = await NotificationSettings.find({
      userId: { $in: participantIds },
      organization: req.user.organization,
      meetings: true,
    }).select("userId");

    const notificationUserIds = notificationUsers.map((n) =>
      n.userId.toString()
    );

    // Send meeting creation notification emails only to users with notifications enabled
    const usersData = await User.find({ _id: { $in: notificationUserIds } });

    for (const u of usersData) {
      try {
        const meetingDetails = formatMeetingDetails(meeting);
        const emailContent = generateMeetingCreationEmail(meetingDetails);

        await sendGridMail({
          to: u.email,
          subject: `Meeting Scheduled: ${meetingDetails.title}`,
          text: emailContent.text,
          html: emailContent.html,
        });
      } catch (emailError) {
        console.error(
          `Failed to send creation email to ${u.email}:`,
          emailError.message
        );
      }
    }

    console.log(
      `Meeting creation emails sent to ${usersData.length} participants with notifications enabled`
    );

    res.status(201).json(meeting);
  } catch (error) {
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: "Failed to create meeting" });
  }
};


// ---------- Helper: Generate Google Meet link (returns null if fails) ----------
// const generateGoogleMeetLink = async (title, startDateTime, endDateTime, attendeeEmails = []) => {
//   try {
//     // Check if credentials exist
//     if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
//       console.warn("⚠️ Google Calendar credentials missing. Skipping Meet link generation.");
//       return null;
//     }
//     const auth = new google.auth.JWT(
//       process.env.GOOGLE_CLIENT_EMAIL,
//       null,
//       process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//       ["https://www.googleapis.com/auth/calendar"]
//     );
//     const calendar = google.calendar({ version: "v3", auth });
//     const event = {
//       summary: title,
//       start: { dateTime: startDateTime.toISOString() },
//       end: { dateTime: endDateTime.toISOString() },
//       conferenceData: { createRequest: { requestId: `${Date.now()}` } },
//       attendees: attendeeEmails.map(email => ({ email }))
//     };
//     const response = await calendar.events.insert({
//       calendarId: "primary",
//       conferenceDataVersion: 1,
//       resource: event
//     });
//     return response.data.hangoutLink;
//   } catch (err) {
//     console.error("Google Meet generation failed:", err.message);
//     return null;
//   }
// };

// // ---------- Helper: Generate Zoom link (returns null if fails) ----------
// const generateZoomLink = async (title, startDateTime, durationMinutes) => {
//   try {
//     if (!process.env.ZOOM_API_KEY || !process.env.ZOOM_API_SECRET) {
//       console.warn("⚠️ Zoom credentials missing. Skipping Zoom link generation.");
//       return null;
//     }
//     const jwt = require("jsonwebtoken");
//     const token = jwt.sign(
//       {
//         iss: process.env.ZOOM_API_KEY,
//         exp: Math.floor(Date.now() / 1000) + 60 * 60
//       },
//       process.env.ZOOM_API_SECRET
//     );
//     const response = await axios.post(
//       "https://api.zoom.us/v2/users/me/meetings",
//       {
//         topic: title,
//         type: 2,
//         start_time: startDateTime.toISOString(),
//         duration: Math.ceil(durationMinutes),
//         timezone: "Asia/Kolkata",
//         settings: { join_before_host: true }
//       },
//       { headers: { Authorization: `Bearer ${token}` } }
//     );
//     return response.data.join_url;
//   } catch (err) {
//     console.error("Zoom link generation failed:", err.message);
//     return null;
//   }
// };

// // ---------- Helper: Generate MS Teams link (stub) ----------
// const generateTeamsLink = async (title, startDateTime, endDateTime) => {
//   console.warn("⚠️ MS Teams link generation not implemented.");
//   return null;
// };

// // ---------- Helper: Create calendar event & send invites (stub) ----------
// const createCalendarEvent = async (meeting, attendeeEmails) => {
//   console.log(`[Calendar] Would send invites to: ${attendeeEmails.join(", ")}`);
//   return null;
// };

// // ---------- Main: Create Meeting ----------

// exports.createMeeting = async (req, res) => {
//   try {
//     const {
//       title,
//       owner,
//       linkedTo,
//       relatedEntityId,
//       activeLinkType,
//       location,
//       startDate,
//       startTime,
//       endTime,
//       reminder,
//       participants,
//       collaborators,
//       associations,
//       meetingType: meetingTypeName,
//       description,
//       doNotSendInvites,
//       createFollowUpTask,
//     } = req.body;
//     console.log(req.body)

//     // ----- 1. Basic validation -----
//     if (!title) return res.status(400).json({ error: "Title is required" });
//     if (!owner) return res.status(400).json({ error: "Owner is required" });
//     if (!linkedTo || !relatedEntityId) {
//       return res.status(400).json({ error: "Related entity is required" });
//     }
//     if (!startDate || !startTime || !endTime) {
//       return res.status(400).json({ error: "Start and end date/time are required" });
//     }

//     // ----- 2. Combine date and time -----
//     const startDateTime = new Date(`${startDate}T${startTime}:00`);
//     const endDateTime = new Date(`${startDate}T${endTime}:00`);
//     if (isNaN(startDateTime) || isNaN(endDateTime)) {
//       return res.status(400).json({ error: "Invalid date/time format" });
//     }
//     if (endDateTime <= startDateTime) {
//       return res.status(400).json({ error: "End time must be after start time" });
//     }

//     // ----- 3. Parse reminder string to minutes -----
//     let reminderMinutes = 30;
//     if (reminder) {
//       const match = reminder.match(/(\d+)/);
//       if (match) {
//         let mins = parseInt(match[1]);
//         if (reminder.includes("Hour")) mins *= 60;
//         if (reminder.includes("Day")) mins *= 1440;
//         reminderMinutes = mins;
//       }
//     }

//     // ----- 4. Verify related entity exists -----
//     let linkedEntity;
//     if (linkedTo === "contact") {
//       linkedEntity = await Contact.findOne({ _id: relatedEntityId, organization: req.user.organization });
//       if (!linkedEntity) return res.status(404).json({ error: "Contact not found" });
//     } else if (linkedTo === "company") {
//       linkedEntity = await Company.findOne({ _id: relatedEntityId, organization: req.user.organization });
//       if (!linkedEntity) return res.status(404).json({ error: "Company not found" });
//     } else if (linkedTo === "vendor") {
//       linkedEntity = await Vendor.findOne({ _id: relatedEntityId, organization: req.user.organization });
//       if (!linkedEntity) return res.status(404).json({ error: "Vendor not found" });
//     } else {
//       return res.status(400).json({ error: "Invalid linkedTo type" });
//     }

//     // ----- 5. Handle meeting type (create default types if needed) -----
//     let meetingTypeDoc = await MeetingType.findOne({ name: meetingTypeName, organization: req.user.organization });
//     if (!meetingTypeDoc) {
//       const defaultTypes = ["Business Development Meeting", "Client Check-in", "Product Demo", "Strategy Session"];
//       if (defaultTypes.includes(meetingTypeName)) {
//         meetingTypeDoc = await MeetingType.create({
//           name: meetingTypeName,
//           organization: req.user.organization,
//           isDefault: true,
//           createdBy: req.user.id,
//         });
//       } else {
//         return res.status(400).json({ error: "Invalid meeting type" });
//       }
//     }

//     // ----- 6. Build `where` object -----
//     const whereData = {
//       googleMeet: activeLinkType === "google",
//       zoom: activeLinkType === "zoom",
//       msTeams: activeLinkType === "teams",
//       googleMeetLink: "",
//       zoomLink: "",
//       msTeamsLink: "",
//       address: location || "",
//     };

//     // Auto-generate links if the platform is selected (and no link provided)
//     if (whereData.googleMeet && !whereData.googleMeetLink) {
//       const link = await generateGoogleMeetLink(title, startDateTime, endDateTime, []);
//       if (link) whereData.googleMeetLink = link;
//     }
//     if (whereData.zoom && !whereData.zoomLink) {
//       const duration = (endDateTime - startDateTime) / 60000;
//       const link = await generateZoomLink(title, startDateTime, duration);
//       if (link) whereData.zoomLink = link;
//     }
//     if (whereData.msTeams && !whereData.msTeamsLink) {
//       const link = await generateTeamsLink(title, startDateTime, endDateTime);
//       if (link) whereData.msTeamsLink = link;
//     }

//     // ----- 7. Build attendees array from participant contact IDs -----
//     const attendeesList = [];
//     if (participants && participants.length) {
//       const contactDocs = await Contact.find({ _id: { $in: participants }, organization: req.user.organization });
//       for (const contact of contactDocs) {
//         attendeesList.push({
//           type: "contact",
//           id: contact._id,
//           name: contact.name,
//           email: contact.email,
//         });
//       }
//     }

//     // ----- 8. Build associations array -----
//     const associationsList = (associations || []).map((assoc) => ({
//       type: assoc.entityModel.toLowerCase(),
//       id: assoc.entityId,
//       name: assoc.entityModel,
//     }));

//     // ----- 9. Create meeting document -----
//     const meeting = new Meeting({
//       title,
//       owner,
//       relatedTo: { type: linkedTo, id: relatedEntityId },
//       where: whereData,
//       startDateTime,
//       endDateTime,
//       reminderMinutes,
//       timeZone: "Asia/Kolkata",
//       attendees: attendeesList,
//       collaborators: collaborators || [],
//       associations: associationsList,
//       meetingType: meetingTypeDoc._id,          // ✅ NOW CORRECT
//       description: description || "",
//       createFollowUpTask: createFollowUpTask || false,
//       doNotSendInvite: doNotSendInvites || false,
//       createdBy: req.user.id,
//       organization: req.user.organization,
//     });

//     await meeting.save();
//     console.log("✅ Meeting saved with ID:", meeting._id);

//     // Populate for response
//     await meeting.populate([
//       { path: "owner", select: "name email" },
//       { path: "collaborators", select: "name email" },
//       { path: "meetingType", select: "name" },
//       { path: "createdBy", select: "name email" },
//     ]);

//     // ----- 10. Calendar invites (if not opted out) -----
//     if (!doNotSendInvites) {
//       const emails = new Set();
//       if (meeting.owner?.email) emails.add(meeting.owner.email);
//       meeting.attendees.forEach((a) => { if (a.email) emails.add(a.email); });
//       const collaboratorUsers = await User.find({ _id: { $in: meeting.collaborators } });
//       collaboratorUsers.forEach((u) => { if (u.email) emails.add(u.email); });
//       if (linkedEntity.email) emails.add(linkedEntity.email);
//       await createCalendarEvent(meeting, Array.from(emails));
//     }

//     // ----- 11. Create follow-up task if requested (FIXED for your Task model) -----
//     if (createFollowUpTask) {
//       await Task.create({
//         title: `Follow-up: ${title}`,
//         description: `Follow-up task for meeting "${title}" held on ${startDateTime.toLocaleString()}`,
//         dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//         status: "Pending",
//         createdBy: req.user.id,
//         organization: req.user.organization,
//       });
//     }

//     res.status(201).json(meeting);
//   } catch (error) {
//     console.error("Error creating meeting:", error);
//     res.status(500).json({ error: error.message || "Failed to create meeting" });
//   }
// };

// // ---------- Endpoint: Generate meeting link on demand ----------
// exports.generateMeetingLink = async (req, res) => {
//   try {
//     const { platform, title, startDateTime, endDateTime, attendees } = req.body;
//     if (!platform || !title) {
//       return res.status(400).json({ error: "Platform and title are required" });
//     }
//     const start = startDateTime ? new Date(startDateTime) : new Date();
//     const end = endDateTime ? new Date(endDateTime) : new Date(start.getTime() + 3600000);
//     const attendeeEmails = (attendees || []).map(a => a.email).filter(Boolean);
//     let link = null;

//     if (platform === "google") {
//       link = await generateGoogleMeetLink(title, start, end, attendeeEmails);
//     } else if (platform === "zoom") {
//       const duration = (end - start) / 60000;
//       link = await generateZoomLink(title, start, duration);
//     } else if (platform === "teams") {
//       link = await generateTeamsLink(title, start, end);
//     } else {
//       return res.status(400).json({ error: "Unsupported platform" });
//     }
//     if (!link) {
//       return res.status(500).json({ error: `Failed to generate ${platform} link` });
//     }
//     res.json({ link });
//   } catch (err) {
//     console.error("Link generation error:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };


// Update meeting
exports.updateMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      scheduledAt,
      duration,
      priority,
      status,
      meetingType,
      location,
      notes,
      outcome,
      participants,
    } = req.body;

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Store original values for comparison
    const originalScheduledAt = meeting.scheduledAt;
    const originalTitle = meeting.title;
    const originalLocation = meeting.location;
    const originalDuration = meeting.duration;
    const originalParticipants =
      meeting.participants?.map((p) => p.toString()) || [];

    // Validate participants belong to organization if updating
    if (participants && meeting.linkedTo === "company") {
      const participantUsers = await Contact.find({
        _id: { $in: participants },
        organization: req.user.organization,
      });
      if (participantUsers.length !== participants.length) {
        return res.status(404).json({
          error: "One or more participants not found in your organization",
        });
      }
    }

    // Track changes for email notification
    const changes = {};
    if (title && title !== meeting.title) {
      changes.title = { from: meeting.title, to: title };
    }
    if (
      scheduledAt &&
      new Date(scheduledAt).getTime() !== originalScheduledAt.getTime()
    ) {
      changes.scheduledAt = {
        from: originalScheduledAt.toLocaleString(),
        to: new Date(scheduledAt).toLocaleString(),
      };
    }
    if (location && location !== meeting.location) {
      changes.location = {
        from: meeting.location || "Not specified",
        to: location,
      };
    }
    if (duration && duration !== meeting.duration) {
      changes.duration = {
        from: `${meeting.duration} minutes`,
        to: `${duration} minutes`,
      };
    }

    // Update fields
    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (scheduledAt) meeting.scheduledAt = new Date(scheduledAt);
    if (duration) meeting.duration = duration;
    if (priority) meeting.priority = priority;
    if (status) meeting.status = status;
    if (meetingType) meeting.meetingType = meetingType;
    if (location) meeting.location = location;
    if (notes) meeting.notes = notes;
    if (outcome) meeting.outcome = outcome;
    if (participants) meeting.participants = participants;

    meeting.updatedBy = req.user.id;
    await meeting.save();

    // Populate and return updated meeting
    await meeting.populate([
      { path: "contact", select: "name email phone" },
      { path: "company", select: "name industry" },
      { path: "vendor", select: "name email" },
      { path: "participants", select: "name email" },
      { path: "createdBy", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

    // Send update notification if significant changes occurred
    if (Object.keys(changes).length > 0) {
      // Gather participant IDs for notification settings check
      const participantIds = [];
      if (meeting.createdBy && meeting.createdBy._id)
        participantIds.push(meeting.createdBy._id);
      if (meeting.contact && meeting.contact._id)
        participantIds.push(meeting.contact._id);
      if (meeting.participants && meeting.participants.length > 0) {
        meeting.participants.forEach((p) => participantIds.push(p._id));
      }

      // Fetch notification settings for meeting participants with meeting notifications enabled
      const notificationUsers = await NotificationSettings.find({
        userId: { $in: participantIds },
        organization: req.user.organization,
        meetings: true,
      }).select("userId");

      const notificationUserIds = notificationUsers.map((n) =>
        n.userId.toString()
      );
      const usersData = await User.find({ _id: { $in: notificationUserIds } });

      for (const u of usersData) {
        try {
          const meetingDetails = formatMeetingDetails(meeting);
          const emailContent = generateMeetingUpdateEmail(
            meetingDetails,
            changes
          );

          await sendGridMail({
            to: u.email,
            subject: `Meeting Updated: ${meetingDetails.title}`,
            text: emailContent.text,
            html: emailContent.html,
          });
        } catch (emailError) {
          console.error(
            `Failed to send update email to ${u.email}:`,
            emailError.message
          );
        }
      }

      console.log(
        `Meeting update emails sent to ${usersData.length} participants with notifications enabled`
      );
    }

    res.json(meeting);
  } catch (error) {
    console.error("Error updating meeting:", error);
    res.status(500).json({ error: "Failed to update meeting" });
  }
};

// Delete meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate([
      { path: "contact", select: "name email phone" },
      { path: "company", select: "name industry" },
      { path: "vendor", select: "name email" },
      { path: "participants", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Gather participant IDs for notification settings check
    const participantIds = [];
    if (meeting.createdBy && meeting.createdBy._id)
      participantIds.push(meeting.createdBy._id);
    if (meeting.contact && meeting.contact._id)
      participantIds.push(meeting.contact._id);
    if (meeting.participants && meeting.participants.length > 0) {
      meeting.participants.forEach((p) => participantIds.push(p._id));
    }

    // Fetch notification settings for meeting participants with meeting notifications enabled
    const notificationUsers = await NotificationSettings.find({
      userId: { $in: participantIds },
      organization: req.user.organization,
      meetings: true,
    }).select("userId");

    const notificationUserIds = notificationUsers.map((n) =>
      n.userId.toString()
    );
    const usersData = await User.find({ _id: { $in: notificationUserIds } });

    // Send cancellation emails before deleting
    for (const u of usersData) {
      try {
        const meetingDetails = formatMeetingDetails(meeting);
        const emailContent = generateMeetingCancellationEmail(meetingDetails);

        await sendGridMail({
          to: u.email,
          subject: `Meeting Cancelled: ${meetingDetails.title}`,
          text: emailContent.text,
          html: emailContent.html,
        });
      } catch (emailError) {
        console.error(
          `Failed to send cancellation email to ${u.email}:`,
          emailError.message
        );
      }
    }

    console.log(
      `Meeting cancellation emails sent to ${usersData.length} participants with notifications enabled`
    );

    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    res.status(500).json({ error: "Failed to delete meeting" });
  }
};

// Mark meeting as completed
exports.completeMeeting = async (req, res) => {
  try {
    const { notes, outcome } = req.body;

    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    meeting.status = "completed";
    meeting.notes = notes || meeting.notes;
    meeting.outcome = outcome || meeting.outcome;
    meeting.updatedBy = req.user.id;

    await meeting.save();

    await meeting.populate([
      { path: "contact", select: "name email phone" },
      { path: "company", select: "name industry" },
      { path: "vendor", select: "name email" },
      { path: "participants", select: "name email" },
      { path: "updatedBy", select: "name email" },
    ]);

    // Gather participant IDs for notification settings check
    const participantIds = [];
    if (meeting.createdBy && meeting.createdBy._id)
      participantIds.push(meeting.createdBy._id);
    if (meeting.contact && meeting.contact._id)
      participantIds.push(meeting.contact._id);
    if (meeting.participants && meeting.participants.length > 0) {
      meeting.participants.forEach((p) => participantIds.push(p._id));
    }

    // Fetch notification settings for meeting participants with meeting notifications enabled
    const notificationUsers = await NotificationSettings.find({
      userId: { $in: participantIds },
      organization: req.user.organization,
      meetings: true,
    }).select("userId");

    const notificationUserIds = notificationUsers.map((n) =>
      n.userId.toString()
    );
    const usersData = await User.find({ _id: { $in: notificationUserIds } });

    // Send completion notification
    for (const u of usersData) {
      try {
        const meetingDetails = formatMeetingDetails(meeting);

        const html = `
          <h2>Meeting Completed: ${meetingDetails.title}</h2>
          <p>The meeting scheduled for ${
            meetingDetails.scheduledAt
          } has been marked as completed.</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
          ${outcome ? `<p><strong>Outcome:</strong> ${outcome}</p>` : ""}
          <p>Thank you for your participation.</p>
        `;

        const text = `
          Meeting Completed: ${meetingDetails.title}
          
          The meeting scheduled for ${
            meetingDetails.scheduledAt
          } has been marked as completed.
          ${notes ? `Notes: ${notes}` : ""}
          ${outcome ? `Outcome: ${outcome}` : ""}
          
          Thank you for your participation.
        `;

        await sendGridMail({
          to: u.email,
          subject: `Meeting Completed: ${meetingDetails.title}`,
          text,
          html,
        });
      } catch (emailError) {
        console.error(
          `Failed to send completion email to ${u.email}:`,
          emailError.message
        );
      }
    }

    console.log(
      `Meeting completion emails sent to ${usersData.length} participants with notifications enabled`
    );

    res.json(meeting);
  } catch (error) {
    console.error("Error completing meeting:", error);
    res.status(500).json({ error: "Failed to complete meeting" });
  }
};

// Send meeting reminders
exports.sendMeetingReminders = async (req, res) => {
  try {
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

    const fiftyMinutesFromNow = new Date();
    fiftyMinutesFromNow.setMinutes(fiftyMinutesFromNow.getMinutes() + 50);

    const meetings = await Meeting.find({
      organization: req.user.organization,
      scheduledAt: {
        $gte: fiftyMinutesFromNow,
        $lte: oneHourFromNow,
      },
      status: "scheduled",
      reminderSent: false,
    }).populate([
      { path: "contact", select: "name email phone" },
      { path: "company", select: "name industry" },
      { path: "vendor", select: "name email" },
      { path: "participants", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    let remindersSent = 0;

    for (const meeting of meetings) {
      try {
        // Gather participant IDs for notification settings check
        const participantIds = [];
        if (meeting.createdBy && meeting.createdBy._id)
          participantIds.push(meeting.createdBy._id);
        if (meeting.contact && meeting.contact._id)
          participantIds.push(meeting.contact._id);
        if (meeting.participants && meeting.participants.length > 0) {
          meeting.participants.forEach((p) => participantIds.push(p._id));
        }

        // Fetch notification settings for meeting participants with meeting notifications enabled
        const notificationUsers = await NotificationSettings.find({
          userId: { $in: participantIds },
          organization: req.user.organization,
          meetings: true,
        }).select("userId");

        const notificationUserIds = notificationUsers.map((n) =>
          n.userId.toString()
        );
        const usersData = await User.find({
          _id: { $in: notificationUserIds },
        });

        const meetingDetails = formatMeetingDetails(meeting);
        const emailContent = generateMeetingReminderEmail(meetingDetails);

        // Send reminder emails to participants with notifications enabled
        for (const u of usersData) {
          try {
            await sendGridMail({
              to: u.email,
              subject: `Reminder: ${meetingDetails.title} starts in 1 hour`,
              text: emailContent.text,
              html: emailContent.html,
            });
          } catch (emailError) {
            console.error(
              `Failed to send reminder email to ${u.email}:`,
              emailError.message
            );
          }
        }

        meeting.reminderSent = true;
        await meeting.save();
        remindersSent++;
        console.log(
          `Reminder sent for meeting: ${meeting.title} to ${usersData.length} users with notifications enabled`
        );
      } catch (emailError) {
        console.error(
          `Error sending reminder for meeting ${meeting._id}:`,
          emailError
        );
      }
    }

    res.json({
      message: `${remindersSent} meeting reminders sent successfully`,
    });
  } catch (error) {
    console.error("Error sending meeting reminders:", error);
    res.status(500).json({ error: "Failed to send meeting reminders" });
  }
};

// Keep all other functions unchanged
exports.getMeetings = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      contactId,
      companyId,
      vendorId,
      participantId,
      status,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { organization: req.user.organization };

    // Date range filter
    if (startDate || endDate) {
      query.scheduledAt = {};
      if (startDate) query.scheduledAt.$gte = new Date(startDate);
      if (endDate) query.scheduledAt.$lte = new Date(endDate);
    }

    // Entity bifurcation - verify entities belong to organization
    if (contactId) {
      const contact = await Contact.findOne({
        _id: contactId,
        organization: req.user.organization,
      });
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      query.$or = [
        { linkedTo: "contact", contact: contactId },
        { participants: contactId },
      ];
    } else if (companyId) {
      const company = await Company.findOne({
        _id: companyId,
        organization: req.user.organization,
      });
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      query.linkedTo = "company";
      query.company = companyId;
    } else if (vendorId) {
      const vendor = await Vendor.findOne({
        _id: vendorId,
        organization: req.user.organization,
      });
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      query.linkedTo = "vendor";
      query.vendor = vendorId;
    }

    // Filter by specific participant
    if (participantId) {
      const participant = await Contact.findOne({
        _id: participantId,
        organization: req.user.organization,
      });
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      query.participants = participantId;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    if (status) query.status = status;

    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .populate([
          { path: "contact", select: "name email phone" },
          { path: "company", select: "name industry" },
          { path: "vendor", select: "name email" },
          { path: "createdBy", select: "name email" },
        ])
        .sort({ scheduledAt: -1 }),
      Meeting.countDocuments(query),
    ]);

    res.json({
      meetings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

exports.getAllMeetings = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const meetings = await Meeting.find(query)
      .populate([
        { path: "contact", select: "name email phone" },
        { path: "company", select: "name industry" },
        { path: "vendor", select: "name email" },
        { path: "participants", select: "name email" },
        { path: "createdBy", select: "name email" },
      ])
      .sort({ createdAt: -1 });
    res.json(meetings);
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
};

exports.getMeetingsPaginated = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "scheduledAt",
      sortOrder = "desc",
      search,
      priority,
      status,
      user,
      scheduledAt,
      meetingType,
    } = req.query;

    // Base query with organization filter
    const query = { organization: req.user.organization };

    // Search filter (title, description, location, notes)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Meeting type filter
    if (meetingType) {
      query.meetingType = meetingType;
    }

    // User/Participant filter
    if (user) {
      query.participants = user;
    }

    // Date filter (scheduled date)
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      query.scheduledAt = {
        $gte: date,
        $lt: nextDay,
      };
    }

    // Pagination calculations
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort configuration
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const [meetings, totalCount] = await Promise.all([
      Meeting.find(query)
        .populate([
          { path: "contact", select: "name email phone" },
          { path: "company", select: "name industry" },
          { path: "vendor", select: "name email" },
          { path: "participants", select: "name email" },
          { path: "createdBy", select: "name email" },
        ])
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      Meeting.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const currentPage = parseInt(page);

    res.json({
      meetings,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching paginated meetings:", error);
    res.status(500).json({
      message: "Failed to fetch meetings",
      error: error.message,
    });
  }
};

exports.getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate([
      { path: "contact", select: "name email phone company" },
      { path: "company", select: "name industry email phone" },
      { path: "vendor", select: "name email phone" },
      { path: "participants", select: "name email" },
      { path: "createdBy", select: "name email" },
    ]);

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.json(meeting);
  } catch (error) {
    console.error("Error fetching meeting:", error);
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
};

exports.getUpcomingMeetings = async (req, res) => {
  try {
    const { days = 7, participantId } = req.query;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));

    const query = {
      organization: req.user.organization,
      scheduledAt: {
        $gte: new Date(),
        $lte: endDate,
      },
      status: "scheduled",
    };

    if (participantId) {
      const participant = await User.findOne({
        _id: participantId,
        organization: req.user.organization,
      });
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }
      query.participants = participantId;
    }

    const meetings = await Meeting.find(query)
      .populate([
        { path: "contact", select: "name email phone" },
        { path: "company", select: "name" },
        { path: "vendor", select: "name" },
        { path: "participants", select: "name" },
      ])
      .sort({ scheduledAt: 1 })
      .limit(10);

    res.json(meetings);
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    res.status(500).json({ error: "Failed to fetch upcoming meetings" });
  }
};

exports.getMeetingsDashboard = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };

    if (req.user.role === "staff") {
      filter.createdBy = req.user._id;
    }

    const meetings = await Meeting.find(filter).populate(
      "contact company vendor participants createdBy"
    );

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMeetingsByParticipant = async (req, res) => {
  try {
    const { participantId } = req.params;
    const { page = 1, limit = 50, status } = req.query;

    const participant = await User.findOne({
      _id: participantId,
      organization: req.user.organization,
    });
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const query = {
      organization: req.user.organization,
      participants: participantId,
    };

    if (status) query.status = status;

    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .populate([
          { path: "contact", select: "name email phone" },
          { path: "company", select: "name industry" },
          { path: "vendor", select: "name email" },
          { path: "participants", select: "name email" },
          { path: "createdBy", select: "name email" },
        ])
        .sort({ scheduledAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit),
      Meeting.countDocuments(query),
    ]);

    res.json({
      meetings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Error fetching meetings by participant:", error);
    res.status(500).json({ error: "Failed to fetch meetings by participant" });
  }
};
