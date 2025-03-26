const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: { type: String, enum: ["admin", "manager", "cashier", "waiter"], default: "waiter" }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
