const express = require("express");
const router = express.Router();
const { getAdminStats } = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { adminProtect } = require("../middleware/adminMiddleware");
const { requirePermission, permissions } = require('../middleware/authorization');

router.get("/stats", protect, adminProtect, requirePermission(permissions.ADMIN_STATS), getAdminStats);

module.exports = router;
