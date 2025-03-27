const Discount = require("../models/Discount");

// Get all active discounts
const getActiveDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({ active: true });
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch discounts" });
  }
};

// Create a new discount
const createDiscount = async (req, res) => {
  const { code, description, percentage, startDate, endDate } = req.body;

  try {
    const newDiscount = new Discount({
      code,
      description,
      percentage,
      startDate,
      endDate,
    });
    await newDiscount.save();
    res.status(201).json(newDiscount);
  } catch (error) {
    res.status(500).json({ message: "Failed to create discount" });
  }
};

// Update an existing discount
const updateDiscount = async (req, res) => {
  const { id } = req.params;
  const { code, description, percentage, startDate, endDate, active } = req.body;

  try {
    const updatedDiscount = await Discount.findByIdAndUpdate(
      id,
      { code, description, percentage, startDate, endDate, active },
      { new: true }
    );
    res.json(updatedDiscount);
  } catch (error) {
    res.status(500).json({ message: "Failed to update discount" });
  }
};

// Delete a discount
const deleteDiscount = async (req, res) => {
  const { id } = req.params;

  try {
    await Discount.findByIdAndDelete(id);
    res.json({ message: "Discount deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete discount" });
  }
};

module.exports = {
  getActiveDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
};