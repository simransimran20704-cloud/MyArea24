import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Trash2, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadMerchantMedia } from '../services/merchantApiService';

interface MediaUploadWidgetProps {
  label?: string;
  sublabel?: string;
  value?: string;
  onChange: (url: string) => void;
  fallbackImage?: string;
  className?: string;
  compact?: boolean;
}

export const MediaUploadWidget: React.FC<MediaUploadWidgetProps> = ({
  label = 'Product Image / Photo',
  sublabel = 'Take a photo with your camera or select from your gallery',
  value,
  onChange,
  fallbackImage = '',
  className = '',
  compact = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string>(value || fallbackImage || '');

  useEffect(() => {
    if (value) {
      setLocalPreview(value);
    } else if (fallbackImage) {
      setLocalPreview(fallbackImage);
    }
  }, [value, fallbackImage]);

  const handleProcessFile = async (file: File) => {
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(false);

    // 1. Instant local preview with zero latency
    const localUrl = URL.createObjectURL(file);
    setLocalPreview(localUrl);

    // 2. Prepare client-side fallback (Base64) in case network drops
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      if (!value) {
        onChange(base64Data);
      }
    };
    reader.readAsDataURL(file);

    // 3. Perform background server/cloud upload
    setIsUploading(true);
    try {
      const result = await uploadMerchantMedia(file);
      if (result.success && result.url) {
        setUploadSuccess(true);
        setLocalPreview(result.url);
        onChange(result.url);
        setTimeout(() => setUploadSuccess(false), 2500);
      } else {
        setUploadError(result.error || 'Upload failed. Using high-res local image.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Network error during upload. Local image preserved.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleProcessFile(file);
    }
  };

  const handleClear = () => {
    setLocalPreview(fallbackImage || '');
    onChange(fallbackImage || '');
    setUploadError(null);
    setUploadSuccess(false);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Hidden native input elements */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Label and Sublabel */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="block font-bold text-slate-700 text-xs">
            {label}
          </label>
          {isUploading && (
            <span className="flex items-center gap-1 text-[10px] text-purple-600 font-bold animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Uploading...
            </span>
          )}
          {uploadSuccess && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
              <Check className="w-3 h-3" />
              Uploaded
            </span>
          )}
        </div>
      )}

      {/* Upload Zone & Preview Card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-3 flex ${
          compact ? 'flex-row items-center gap-3' : 'flex-col sm:flex-row items-center gap-3.5'
        } transition hover:border-purple-300 hover:bg-purple-50/20 overflow-hidden`}
      >
        {/* Thumbnail Preview */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 shadow-xs flex items-center justify-center">
          {localPreview ? (
            <img
              src={localPreview}
              alt="Media Preview"
              className="w-full h-full object-cover"
              onError={() => {
                if (fallbackImage) setLocalPreview(fallbackImage);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
              <ImageIcon className="w-6 h-6 mb-1 text-slate-400" />
              <span className="text-[9px] font-medium leading-tight">No Image</span>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2 w-full">
          {sublabel && (
            <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
              {sublabel}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Native Camera Capture Button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => cameraInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Take Photo</span>
            </button>

            {/* Browse / Gallery Button */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => galleryInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-purple-600" />
              <span>Browse Files</span>
            </button>

            {/* Remove / Reset Button */}
            {localPreview && localPreview !== fallbackImage && (
              <button
                type="button"
                onClick={handleClear}
                title="Remove photo"
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {uploadError && (
            <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 leading-tight">
              ℹ️ {uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
