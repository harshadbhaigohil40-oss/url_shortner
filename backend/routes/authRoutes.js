const express = require("express");
const router = express.Router();
const { registerUser, loginUser, refreshToken, logoutUser, generateApiKey, getApiKeyDetails, revokeApiKey, googleAuth, requestPasswordReset, resetPassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { validate, registerSchema, loginSchema, passwordResetRequestSchema, passwordResetSchema } = require("../middleware/validation");
const { authLimiter } = require("../middleware/rateLimiter");

router.post("/register", authLimiter, validate(registerSchema), registerUser);
router.post("/login", authLimiter, validate(loginSchema), loginUser);
router.post("/google", authLimiter, googleAuth);
router.post("/password-reset/request", authLimiter, validate(passwordResetRequestSchema), requestPasswordReset);
router.post("/password-reset/confirm", authLimiter, validate(passwordResetSchema), resetPassword);

router.post("/logout", logoutUser);
router.get("/refresh", refreshToken);
router.get("/api-key", protect, getApiKeyDetails);
router.post("/generate-api-key", protect, generateApiKey);
router.delete("/api-key", protect, revokeApiKey);

module.exports = router;
