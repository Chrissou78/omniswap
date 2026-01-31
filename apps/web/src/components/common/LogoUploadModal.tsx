'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Image as ImageIcon, Link, Loader2, Check, AlertCircle } from 'lucide-react';
import { uploadCustomLogo } from '@/services/logoService';

interface LogoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (logoUrl: string) => void;
  type: 'token' | 'chain';
  id: string;
  title?: string;
}

export const LogoUploadModal: React.FC<LogoUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  type,
  id,
  title = 'Upload Logo',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const resetState = () => {
    setUrlInput('');
    setError(null);
    setPreview(null);
    setIsLoading(false);
  };
  
  const handleClose = () => {
    resetState();
    onClose();
  };
  
  // File upload handler
  const handleFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    
    try {
      // Validate
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file (PNG, JPG, SVG, or WebP)');
      }
      
      if (file.size > 500 * 1024) {
        throw new Error('Image must be less than 500KB');
      }
      
      // Preview
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      
      // Upload
      const result = await uploadCustomLogo(file, type, id);
      onUpload(result.url);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);
  
  // URL handler
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Validate URL
      new URL(urlInput);
      
      // Test if image loads
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image from URL'));
        img.src = urlInput;
        setTimeout(() => reject(new Error('Image load timeout')), 10000);
      });
      
      // Fetch and convert to base64 for caching
      const response = await fetch(urlInput);
      const blob = await response.blob();
      const file = new File([blob], 'logo.png', { type: blob.type });
      
      const result = await uploadCustomLogo(file, type, id);
      onUpload(result.url);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid URL or failed to load image');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => { setActiveTab('upload'); resetState(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={() => { setActiveTab('url'); resetState(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Link className="w-4 h-4" />
            From URL
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          {activeTab === 'upload' ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
              }`}
            >
              {preview ? (
                <div className="flex flex-col items-center gap-4">
                  <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover" />
                  <p className="text-sm text-gray-500">Click or drag to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-medium">
                      Drop image here or click to upload
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PNG, JPG, SVG or WebP (max 500KB)
                    </p>
                  </div>
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <button
                onClick={handleUrlSubmit}
                disabled={isLoading || !urlInput.trim()}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Use This Image
                  </>
                )}
              </button>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {/* Loading overlay for upload */}
          {isLoading && activeTab === 'upload' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processing image...</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 pt-0">
          <p className="text-xs text-gray-500 text-center">
            Recommended: Square image, 128x128px or larger
          </p>
        </div>
      </div>
    </div>
  );
};
