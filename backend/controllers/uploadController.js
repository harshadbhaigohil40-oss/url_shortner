const BioPage = require('../models/BioPage');
const fs = require('fs/promises');
const path = require('path');
const { uploadRoot } = require('../middleware/upload');
const { isSafeAvatarFilename } = require('../utils/security');

exports.uploadAvatar = async (req, res, next) => {
  try {
    const bioPage = await BioPage.findOne({ _id: req.params.id, user: req.user._id });
    if (!bioPage) {
      await fs.unlink(req.uploadedFile.path).catch(() => {});
      return res.status(404).json({ message: 'Bio page not found' });
    }

    const previousPath = bioPage.avatarStoragePath;
    bioPage.avatarUrl = `${process.env.PRIVATE_FILE_BASE_URL || '/api/bio/files'}/${req.uploadedFile.filename}`;
    bioPage.avatarStoragePath = req.uploadedFile.path;
    await bioPage.save();
    if (previousPath && previousPath !== req.uploadedFile.path) await fs.unlink(previousPath).catch(() => {});
    return res.json({ avatarUrl: bioPage.avatarUrl });
  } catch (error) {
    await fs.unlink(req.uploadedFile?.path).catch(() => {});
    return next(error);
  }
};

exports.serveAvatar = async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);
    if (!isSafeAvatarFilename(filename)) {
      return res.status(400).json({ message: 'Invalid avatar filename' });
    }
    const filePath = path.join(uploadRoot, filename);
    const file = await fs.readFile(filePath);
    res.setHeader('Content-Type', filename.endsWith('.png') ? 'image/png' : filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(file);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'Avatar not found' });
    return next(error);
  }
};
