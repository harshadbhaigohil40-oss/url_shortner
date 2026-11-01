const express = require("express");
const router = express.Router();
const bioController = require("../controllers/bioController");
const { protect } = require("../middleware/authMiddleware");
const { validate, bioSchema, bioUpdateSchema, objectIdSchema, bioPublicParamsSchema, bioLinkParamsSchema } = require("../middleware/validation");
const { permissions, requirePermission, requireOwner } = require('../middleware/authorization');
const BioPage = require('../models/BioPage');
const { secureUpload } = require('../middleware/upload');
const { uploadAvatar, serveAvatar } = require('../controllers/uploadController');

// Public endpoints
router.get("/public/:slug", validate(bioPublicParamsSchema, "params"), bioController.getPublicBioPage);
router.get("/files/:filename", serveAvatar);
router.post("/public/:slug/click/:linkId", validate(bioLinkParamsSchema, "params"), bioController.trackLinkClick);

// Protected user endpoints
router.post("/", protect, requirePermission(permissions.BIO_CREATE), validate(bioSchema), bioController.createBioPage);
router.get("/my", protect, bioController.getUserBioPages);
router.post("/:id/avatar", protect, requirePermission(permissions.BIO_EDIT_OWN), validate(objectIdSchema, "params"), requireOwner((req) => BioPage.findById(req.params.id)), secureUpload, uploadAvatar);
router.put("/:id", protect, requirePermission(permissions.BIO_EDIT_OWN), validate(objectIdSchema, "params"), requireOwner((req) => BioPage.findById(req.params.id)), validate(bioUpdateSchema), bioController.updateBioPage);
router.delete("/:id", protect, requirePermission(permissions.BIO_DELETE_OWN), validate(objectIdSchema, "params"), requireOwner((req) => BioPage.findById(req.params.id)), bioController.deleteBioPage);

module.exports = router;
