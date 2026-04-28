import React, { useState, useRef } from 'react';
import { uploadApi } from '../../api/uploadApi';

const FileUpload = ({ 
  folder, 
  entityId, 
  onUploadComplete, 
  onUpload,
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSize = 10, // 10MB
  label = "Upload File",
  subtitle
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds ${maxSize}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    setUploadedFile(null);

    try {
      // 1. Get Presigned URL
      const { data: { uploadUrl, fileKey } } = await uploadApi.getPresignedUpload({
        folder,
        fileName: file.name,
        contentType: file.type,
        entityId
      });

      // 2. Upload directly to R2
      await uploadApi.uploadFileDirect(uploadUrl, file, (pct) => {
        setProgress(pct);
      });

      // 3. Callback
      const uploadResult = {
        name: file.name,
        fileName: file.name,
        fileKey,
        size: file.size,
        contentType: file.type,
        url: uploadUrl.split('?')[0]
      };
      if (onUploadComplete) onUploadComplete(uploadResult);
      if (onUpload) onUpload(uploadResult);
      
      setUploadedFile(file.name);
      setUploading(false);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
      />
      
      <div 
        onClick={() => !uploading && fileInputRef.current.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${uploading ? 'border-blue-500/50 bg-blue-500/5' : 
            uploadedFile ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
          ${error ? 'border-red-500/50 bg-red-500/5' : ''}
        `}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-blue-400 font-medium">{progress}% Uploading...</span>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center gap-2">
            <i className="ri-checkbox-circle-fill text-2xl text-green-500"></i>
            <span className="text-sm font-bold text-green-400 truncate max-w-full px-2">{uploadedFile}</span>
            <span className="text-[10px] text-green-500/60 uppercase font-black tracking-widest">Upload Complete</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <i className={`ri-upload-cloud-2-line text-2xl ${error ? 'text-red-400' : 'text-gray-400'}`}></i>
            <span className="text-sm font-medium text-gray-300">{error || label}</span>
            <span className="text-xs text-gray-500">{subtitle || `Max size ${maxSize}MB`}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
