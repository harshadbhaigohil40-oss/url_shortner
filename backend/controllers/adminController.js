const User = require("../models/User");
const Url = require("../models/Url");
const AuditLog = require("../models/AuditLog");

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalUrls = await Url.countDocuments();
    
    // Aggregate total clicks
    const clicksData = await Url.aggregate([
      { $group: { _id: null, totalClicks: { $sum: "$clicks" } } }
    ]);
    const totalClicks = clicksData.length > 0 ? clicksData[0].totalClicks : 0;

    const urlPage = parseInt(req.query.urlPage) || 1;
    const urlLimit = parseInt(req.query.urlLimit) || 20;
    const urlSkip = (urlPage - 1) * urlLimit;
    const rawSearch = req.query.search ? req.query.search.trim() : "";
    const search = rawSearch ? escapeRegex(rawSearch) : "";

    let urlFilter = {};
    if (search) {
      const matchingUsers = await User.find({ email: { $regex: search, $options: "i" } }).select("_id");
      const userIds = matchingUsers.map(u => u._id);
      urlFilter = {
        $or: [
          { shortCode: { $regex: search, $options: "i" } },
          { longUrl: { $regex: search, $options: "i" } },
          { user: { $in: userIds } }
        ]
      };
    }

    const recentUrls = await Url.find(urlFilter).populate("user", "email").sort({ createdAt: -1 }).skip(urlSkip).limit(urlLimit);
    const filteredTotalUrls = await Url.countDocuments(urlFilter);

    const auditPage = parseInt(req.query.auditPage) || 1;
    const auditLimit = parseInt(req.query.auditLimit) || 50;
    const auditSkip = (auditPage - 1) * auditLimit;

    let auditFilter = {};
    if (search) {
      auditFilter = {
        $or: [
          { userEmail: { $regex: search, $options: "i" } },
          { action: { $regex: search, $options: "i" } },
          { details: { $regex: search, $options: "i" } }
        ]
      };
    }

    const auditLogs = await AuditLog.find(auditFilter).sort({ createdAt: -1 }).skip(auditSkip).limit(auditLimit);
    const totalAuditLogs = await AuditLog.countDocuments(auditFilter);

    res.json({
      stats: { totalUsers, totalUrls, totalClicks },
      recentUrls,
      urlPagination: {
        page: urlPage,
        totalPages: Math.ceil(filteredTotalUrls / urlLimit),
        total: filteredTotalUrls
      },
      auditLogs,
      auditPagination: {
        page: auditPage,
        totalPages: Math.ceil(totalAuditLogs / auditLimit),
        total: totalAuditLogs
      }
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
