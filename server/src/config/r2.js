const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned URL for uploading a file directly to R2
 */
const generatePresignedUpload = async (key, contentType, expiresIn = 900) => {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  return uploadUrl;
};

/**
 * Generate a presigned URL for downloading/viewing a file from R2
 */
const generatePresignedDownload = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn });
  return downloadUrl;
};

/**
 * Delete an object from R2
 */
const deleteObject = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  return await r2Client.send(command);
};

module.exports = {
  r2Client,
  generatePresignedUpload,
  generatePresignedDownload,
  deleteObject,
};
