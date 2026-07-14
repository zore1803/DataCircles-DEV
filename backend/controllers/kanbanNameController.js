const KanbanName = require('../models/KanbanName');

exports.createKanbanName = async (req, res) => {
  try {
    const name = req.body.name;
    const organization = req.user.organization;

    const existing = await KanbanName.findOne({ organization });
    if (existing) {
      return res.status(400).json({
        message: "Kanban name already exists for this organization. Use update instead.",
      });
    }

    await KanbanName.create({ organization, name });
    res.json({ message: "name created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error creating the kanban name" });
  }
};

exports.getKanbanName = async (req, res) => {
  try {
    const organization = req.user.organization;

    let name = await KanbanName.findOne({ organization });

    if (!name) {
      name = await KanbanName.create({ organization, name: "Deal" });
    }

    res.json(name);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching the kanban name" });
  }
};

exports.updateKanbanName = async (req, res) => {
  try {
    const organization = req.user.organization;

    const updated = await KanbanName.findOneAndUpdate(
      { organization },
      { name: req.body.name },
      { new: true, upsert: true }
    );

    res.json({ message: "kanban name updated successfully", name: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error updating the kanban name" });
  }
};
