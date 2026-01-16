import { useState, useCallback } from 'react';
import { useToast } from '../components/ui/toaster';

interface UploadResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface UseFileUploadOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  successMessage?: string;
  errorMessage?: string;
}

export function useFileUpload(endpoint: string, options: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { addToast } = useToast();
  
  const {
    onSuccess,
    onError,
    maxSizeMB = 10,
    acceptedTypes = ['text/plain'],
    successMessage = 'File uploaded successfully',
    errorMessage: defaultErrorMessage = 'Failed to upload file',
  } = options;

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      if (!file) {
        const error = 'No file provided';
        onError?.(error);
        addToast({
          title: 'Upload Failed',
          description: error,
          type: 'error',
        });
        return { success: false, error };
      }

      // Validate file type
      if (!acceptedTypes.includes(file.type) && !acceptedTypes.includes('*/*')) {
        const error = `Unsupported file type. Allowed types: ${acceptedTypes.join(', ')}`;
        onError?.(error);
        addToast({
          title: 'Upload Failed',
          description: error,
          type: 'error',
        });
        return { success: false, error };
      }

      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        const error = `File is too large. Maximum size is ${maxSizeMB}MB.`;
        onError?.(error);
        addToast({
          title: 'Upload Failed',
          description: error,
          type: 'error',
        });
        return { success: false, error };
      }

      const formData = new FormData();
      formData.append('file', file);

      // Add loading toast
      const toastId = addToast({
        title: 'Uploading...',
        description: 'Your file is being uploaded',
        type: 'default',
        duration: 0, // Don't auto-dismiss
      });

      try {
        setIsUploading(true);
        setProgress(0);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Upload failed with status ${response.status}`
          );
        }

        const data = await response.json();
        onSuccess?.(data);
        
        // Update toast to success
        addToast({
          id: toastId,
          title: 'Success',
          description: successMessage,
          type: 'success',
          duration: 5000,
        });
        
        return { success: true, data };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : defaultErrorMessage;
        onError?.(errorMessage);
        
        // Update toast to error
        addToast({
          id: toastId,
          title: 'Upload Failed',
          description: errorMessage,
          type: 'error',
          duration: 5000,
        });
        
        return { success: false, error: errorMessage };
      } finally {
        setIsUploading(false);
        setProgress(0);
      }
    },
    [endpoint, onSuccess, onError, maxSizeMB, acceptedTypes, successMessage, defaultErrorMessage, addToast]
  );

  return {
    uploadFile,
    isUploading,
    progress,
  };
}
