import { useCallback, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

export const useMultipartUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(null);
  const abortControllerRef = useRef(null);
  const uploadStateRef = useRef(null);

  const uploadFile = useCallback(async file => {
    if (!file) return null;

    // For small files, return null to use traditional upload
    if (file.size < SMALL_FILE_THRESHOLD) {
      return null;
    }

    setUploading(true);
    setProgress(0);
    setCurrentFile(file.name);
    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Start multipart upload
      const {
        data: { uploadId, key, totalParts, chunkSize },
      } = await api.post("/multipart/start", {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      });

      uploadStateRef.current = { uploadId, key };

      const parts = [];
      let uploadedParts = 0;

      // Step 2: Upload each part with retry logic
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error("Upload cancelled");
        }

        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        let retries = 3;
        let uploaded = false;

        while (retries > 0 && !uploaded) {
          try {
            // Get signed URL for this part
            const {
              data: { signedUrl },
            } = await api.get("/multipart/signed-url", {
              params: { uploadId, key, partNumber },
            });

            // Upload directly to S3
            const uploadResponse = await fetch(signedUrl, {
              method: "PUT",
              body: chunk,
              headers: {
                "Content-Type": file.type || "application/octet-stream",
              },
              signal: abortControllerRef.current?.signal,
            });

            if (!uploadResponse.ok) {
              throw new Error(
                `Part ${partNumber} upload failed with status ${uploadResponse.status}`
              );
            }

            const etag = uploadResponse.headers.get("ETag");
            if (!etag) {
              throw new Error(`Part ${partNumber} missing ETag header`);
            }

            parts.push({ ETag: etag, PartNumber: partNumber });
            uploaded = true;
            uploadedParts++;

            // Update progress
            setProgress(Math.round((uploadedParts / totalParts) * 100));
          } catch (error) {
            retries--;
            if (retries === 0) {
              throw error;
            }
            // Wait before retry (exponential backoff)
            const delay = 1000 * (4 - retries);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Step 3: Complete upload
      const {
        data: { location, key: finalKey },
      } = await api.post("/multipart/complete", {
        uploadId,
        key,
        parts,
      });

      toast.success(`Upload completed: ${file.name}`);
      setUploading(false);
      setProgress(100);
      uploadStateRef.current = null;

      return { location, key: finalKey };
    } catch (error) {
      console.error("Upload error:", error);

      // Attempt to abort the upload on S3
      if (uploadStateRef.current) {
        try {
          await api.post("/multipart/abort", {
            uploadId: uploadStateRef.current.uploadId,
            key: uploadStateRef.current.key,
          });
        } catch (abortError) {
          console.error("Failed to abort upload:", abortError);
        }
      }

      if (error.message !== "Upload cancelled") {
        toast.error(`Upload failed: ${error.message}`);
      }

      setUploading(false);
      setProgress(0);
      setCurrentFile(null);
      uploadStateRef.current = null;

      return null;
    }
  }, []);

  const cancelUpload = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (uploadStateRef.current) {
      try {
        await api.post("/multipart/abort", {
          uploadId: uploadStateRef.current.uploadId,
          key: uploadStateRef.current.key,
        });
        toast.info("Upload cancelled");
      } catch (error) {
        console.error("Cancel error:", error);
      }
    }

    setUploading(false);
    setProgress(0);
    setCurrentFile(null);
    uploadStateRef.current = null;
  }, []);

  return {
    uploadFile,
    cancelUpload,
    uploading,
    progress,
    currentFile,
  };
};
