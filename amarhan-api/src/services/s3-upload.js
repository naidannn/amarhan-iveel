const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

/**
 * S3 Upload Service
 * Handles file uploads to AWS S3
 */

class S3UploadService {
  constructor() {
    // Always use S3 for file uploads
    this.useS3 = true;
    this._s3 = null;
  }

  /**
   * S3 client-ийг анх хэрэглэх үед үүсгэнэ.
   *
   * Эрхийг ЗӨВХӨН орчны хувьсагчаас авна — хатуу кодлосон fallback байхгүй.
   * Lazy байдгийн шалтгаан: энэ модулийг import хийхэд AWS тохиргоо шаардагдвал
   * S3 огт хэрэглэдэггүй орчинд (тест, локал) апп эхлэхгүй болно.
   */
  get s3() {
    if (this._s3) return this._s3;

    const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET } = process.env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
      throw new Error(
        'S3 тохиргоо дутуу: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET шаардлагатай'
      );
    }

    this._s3 = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'ap-southeast-1',
      signatureVersion: 'v4',
    });
    return this._s3;
  }

  get bucketName() {
    return process.env.AWS_S3_BUCKET;
  }

  /**
   * Upload file buffer to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} fileName - Unique file name
   * @param {String} mimeType - MIME type
   * @returns {Promise<Object>} Upload result with key/path and metadata
   */
  async uploadFile(fileBuffer, fileName, mimeType) {
    try {
      // Always upload to S3
      return await this._uploadToS3(fileBuffer, fileName, mimeType);
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Upload to AWS S3
   * @private
   */
  async _uploadToS3(fileBuffer, fileName, mimeType) {
    const params = {
      Bucket: this.bucketName,
      Key: `files/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`,
      Body: fileBuffer,
      ContentType: mimeType,
      ServerSideEncryption: 'AES256',
      // Add optional ACL (use 'private' for security)
      ACL: 'private',
    };

    console.log(`📤 Uploading to S3: ${params.Key}`);

    const result = await this.s3.upload(params).promise();

    return {
      success: true,
      storage: 's3',
      s3_key: result.Key,
      s3_url: result.Location,
      file_path: `/s3/${params.Key}`,
      etag: result.ETag,
    };
  }

  /**
   * Upload to local storage
   * @private
   */
  async _uploadToLocal(fileBuffer, fileName) {
    const filePath = path.join(this.uploadDir, fileName);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, fileBuffer, (err) => {
        if (err) {
          console.error('Local upload error:', err);
          reject(err);
        } else {
          console.log(`📁 File saved locally: ${filePath}`);
          resolve({
            success: true,
            storage: 'local',
            file_path: `/uploads/${fileName}`,
            file_size: fileBuffer.length,
          });
        }
      });
    });
  }

  /**
   * Get pre-signed URL for download from S3
   * @param {String} s3Key - S3 object key
   * @param {Number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {String} Pre-signed URL
   */
  getSignedUrl(s3Key, expiresIn = 3600) {
    try {
      const url = this.s3.getSignedUrl('getObject', {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: expiresIn,
      });
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {String} s3Key - S3 object key
   */
  async deleteFile(s3Key) {
    try {
      // Always delete from S3
      return await this._deleteFromS3(s3Key);
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  /**
   * Delete from S3
   * @private
   */
  async _deleteFromS3(s3Key) {
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    console.log(`🗑️ Deleting from S3: ${s3Key}`);

    await this.s3.deleteObject(params).promise();

    return {
      success: true,
      message: 'File deleted from S3',
    };
  }

  /**
   * Delete from local storage
   * @private
   */
  async _deleteFromLocal(fileName) {
    const filePath = path.join(this.uploadDir, fileName);

    return new Promise((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Local delete error:', err);
            reject(err);
          } else {
            console.log(`🗑️ File deleted locally: ${filePath}`);
            resolve({
              success: true,
              message: 'File deleted from local storage',
            });
          }
        });
      } else {
        resolve({
          success: true,
          message: 'File not found',
        });
      }
    });
  }

  /**
   * Get file from S3
   * @param {String} s3Key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async getFile(s3Key) {
    try {
      // Always get from S3
      return await this._getFromS3(s3Key);
    } catch (error) {
      console.error('Get file error:', error);
      throw error;
    }
  }

  /**
   * Get from S3
   * @private
   */
  async _getFromS3(s3Key) {
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    const result = await this.s3.getObject(params).promise();
    return result.Body;
  }

  /**
   * Get from local storage
   * @private
   */
  async _getFromLocal(fileName) {
    const filePath = path.join(this.uploadDir, fileName);

    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get file size from S3
   * @param {String} s3Key - S3 object key
   * @returns {Promise<Number>} File size in bytes
   */
  async getFileSize(s3Key) {
    try {
      // Always get from S3
      return await this._getFileSizeS3(s3Key);
    } catch (error) {
      console.error('Get file size error:', error);
      throw error;
    }
  }

  /**
   * Get file size from S3
   * @private
   */
  async _getFileSizeS3(s3Key) {
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    const result = await this.s3.headObject(params).promise();
    return result.ContentLength;
  }

  /**
   * Get file size from local storage
   * @private
   */
  async _getFileSizeLocal(fileName) {
    const filePath = path.join(this.uploadDir, fileName);

    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats.size);
        }
      });
    });
  }
}

// Export singleton instance
module.exports = new S3UploadService();

