const multer = require("multer");

const { sendSuccess } = require("../utils/apiResponse");
const { storeFile } = require("../services/storageService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadSingle = async (req, res) => {
  const file = await storeFile(req.file);
  return sendSuccess(res, { file }, undefined, 201);
};

module.exports = { upload, uploadSingle };
