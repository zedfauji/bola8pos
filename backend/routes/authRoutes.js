const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// User registration
router.post("/register", authController.registerUser);

// User login
router.post("/login", authController.loginUser);

// User logout
router.post("/logout", authController.logoutUser);

// Get current authenticated user
router.get("/me", authController.getAuthenticatedUser);
console.log(authController); // Check if the controller is properly loaded

module.exports = router;
