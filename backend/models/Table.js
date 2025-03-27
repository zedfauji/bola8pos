const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["available", "occupied", "reserved"],
    default: "available",
  },
});

const Table = mongoose.model("Table", tableSchema);

module.exports = Table;