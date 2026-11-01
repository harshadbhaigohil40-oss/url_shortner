const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { shortenLimiter, unlockLimiter, analysisLimiter } = require('../middleware/rateLimiter');
const { validate, shortenSchema, editUrlSchema, unlockSchema, aiAnalyzeSchema, bulkSchema, objectIdSchema, codeSchema, listQuerySchema } = require('../middleware/validation');
const { permissions, requirePermission, requireOwner } = require('../middleware/authorization');
const Url = require('../models/Url');

router.get('/stream-clicks', protect, urlController.streamClicks);
router.post('/ai-analyze', protect, analysisLimiter, validate(aiAnalyzeSchema), urlController.analyzeUrlWithAi);
router.post(['/shorten', '/item'], optionalProtect, shortenLimiter, validate(shortenSchema), urlController.shortenUrl);
router.post('/shorten/bulk', protect, requirePermission(permissions.URL_CREATE), shortenLimiter, validate(bulkSchema), urlController.bulkShortenUrl);
router.get(['/myurls', '/item'], protect, requirePermission(permissions.URL_READ_OWN), validate(listQuerySchema, 'query'), urlController.getUserUrls);
router.get('/myurls/stats', protect, requirePermission(permissions.ANALYTICS_READ_OWN), urlController.getUserStats);
router.put('/urls/:id/toggle', protect, requirePermission(permissions.URL_EDIT_OWN), validate(objectIdSchema, 'params'), requireOwner((req) => Url.findById(req.params.id)), urlController.toggleUrlStatus);
router.put('/urls/:id', protect, requirePermission(permissions.URL_EDIT_OWN), validate(objectIdSchema, 'params'), requireOwner((req) => Url.findById(req.params.id)), validate(editUrlSchema), urlController.editUrl);
router.delete(['/urls/:id', '/item/:id'], protect, requirePermission(permissions.URL_DELETE_OWN), validate(objectIdSchema, 'params'), requireOwner((req) => Url.findById(req.params.id)), urlController.deleteUrl);
router.post('/unlock/:code', unlockLimiter, validate(codeSchema, 'params'), validate(unlockSchema), urlController.unlockUrl);
router.get(['/:code', '/item/:code'], validate(codeSchema, 'params'), urlController.redirectUrl);

module.exports = router;
