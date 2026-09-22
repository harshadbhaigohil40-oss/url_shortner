const express = require('express');
const router = express.Router();
const urlController = require('../controllers/urlController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { shortenLimiter } = require('../middleware/rateLimiter');
const { validate, shortenSchema, editUrlSchema } = require('../middleware/validation');

router.get('/stream-clicks', protect, urlController.streamClicks);
router.post('/ai-analyze', protect, urlController.analyzeUrlWithAi);
router.post(['/shorten', '/item'], optionalProtect, shortenLimiter, validate(shortenSchema), urlController.shortenUrl);
router.post('/shorten/bulk', protect, shortenLimiter, urlController.bulkShortenUrl);
router.get(['/myurls', '/item'], protect, urlController.getUserUrls);
router.get('/myurls/stats', protect, urlController.getUserStats);
router.put('/urls/:id/toggle', protect, urlController.toggleUrlStatus);
router.put('/urls/:id', protect, validate(editUrlSchema), urlController.editUrl);
router.delete(['/urls/:id', '/item/:id'], protect, urlController.deleteUrl);
router.post('/unlock/:code', urlController.unlockUrl);
router.get(['/:code', '/item/:code'], urlController.redirectUrl);

module.exports = router;
