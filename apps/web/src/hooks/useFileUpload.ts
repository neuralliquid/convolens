import { useState, useCallback } from "react";
import { toast } from "../components/ui/toaster";

export interface UploadResult {
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

export function useFileUpload(
  endpoint: string,
  options: UseFileUploadOptions = {},
) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const {
    onSuccess,
    onError,
    maxSizeMB = 10,
    acceptedTypes = ["text/plain"],
    successMessage = "File uploaded successfully",
    errorMessage: defaultErrorMessage = "Failed to upload file",
  } = options;

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      if (!file) {
        const error = "No file provided";
        onError?.(error);
        toast({
          title: "Upload Failed",
          description: error,
          variant: "destructive",
        });
        return { success: false, error };
      }

      // Validate file type. Browsers report inconsistent (sometimes empty
      // or generic) MIME types for less common formats like .zip, so an
      // entry in `acceptedTypes` starting with "." is matched against the
      // filename suffix instead of `file.type`. This is a UX check only —
      // the API re-validates by extension and magic bytes server-side.
      const matchesExtension = acceptedTypes.some(
        (accepted) =>
          accepted.startsWith(".") &&
          file.name.toLowerCase().endsWith(accepted.toLowerCase()),
      );
      if (
        !acceptedTypes.includes(file.type) &&
        !acceptedTypes.includes("*/*") &&
        !matchesExtension
      ) {
        const error = `Unsupported file type. Allowed types: ${acceptedTypes.join(", ")}`;
        onError?.(error);
        toast({
          title: "Upload Failed",
          description: error,
          variant: "destructive",
        });
        return { success: false, error };
      }

      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        const error = `File is too large. Maximum size is ${maxSizeMB}MB.`;
        onError?.(error);
        toast({
          title: "Upload Failed",
          description: error,
          variant: "destructive",
        });
        return { success: false, error };
      }

      const formData = new FormData();
      formData.append("file", file);

      // Add loading toast
      const uploadToast = toast({
        title: "Uploading...",
        description: "Your file is being uploaded",
        variant: "default",
        duration: 0, // Don't auto-dismiss
      });

      try {
        setIsUploading(true);
        setProgress(0);

        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Upload failed with status ${response.status}`,
          );
        }

        const data = await response.json();
        onSuccess?.(data);

        // Update toast to success
        uploadToast.update({
          title: "Success",
          description: successMessage,
          variant: "success",
          duration: 5000,
        });

        return { success: true, data };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : defaultErrorMessage;
        onError?.(errorMessage);

        // Update toast to error
        uploadToast.update({
          title: "Upload Failed",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });

        return { success: false, error: errorMessage };
      } finally {
        setIsUploading(false);
        setProgress(0);
      }
    },
    [
      endpoint,
      onSuccess,
      onError,
      maxSizeMB,
      acceptedTypes,
      successMessage,
      defaultErrorMessage,
    ],
  );

  return {
    uploadFile,
    isUploading,
    progress,
  };
}
