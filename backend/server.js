require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");

// Import routes
const authRoutes = require("./routes/authRoutes");
const discountRoutes = require("./routes/discountRoutes");
const reportRoutes = require("./routes/reportRoutes");
const tableRoutes = require("./routes/tableRoutes");
const orderRoutes = require("./routes/orderRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// Create an Express app
const app = express();

// Middleware
app.use(express.json());
app.use(morgan("dev"));  // For logging requests
app.use(cors());  // Enable Cross-Origin Resource Sharing

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/discount", discountRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/table", tableRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/payment", paymentRoutes);

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
