import {
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  BrokenImage as BrokenImageIcon,
  InsertDriveFile as FileIcon,
  Refresh as RefreshIcon,
} from "@material-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { getBackendURL } from "../../services/config";
import PdfPreview from "./PdfPreview";

const useStyles = makeStyles((theme) => ({
  container: {
    position: "relative",
    display: "inline-block",
    borderRadius: theme.spacing(1),
    overflow: "hidden",
    backgroundColor: theme.palette.grey[100],
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    minHeight: 120,
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[600],
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    backgroundColor: theme.palette.grey[50],
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(1),
    minHeight: 120,
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.contrastText,
  },
  retryButton: {
    marginTop: theme.spacing(1),
    color: theme.palette.error.contrastText,
  },
  icon: {
    fontSize: 48,
    marginBottom: theme.spacing(1),
  },
  thumbnail: {
    width: 64,
    height: 64,
  },
  medium: {
    width: 200,
    height: 150,
  },
  full: {
    width: "100%",
    maxWidth: 400,
    height: "auto",
  },
}));

const MediaPreview = ({
  mediaUrl,
  size = "medium",
  alt,
  onLoadStart,
  onLoadComplete,
  onError,
  fallbackComponent,
  ...props
}) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 2;

  // Helper function to detect file type
  const getFileType = useCallback((url) => {
    if (!url) return "unknown";

    const extension = url.split(".").pop()?.toLowerCase();

    if (["pdf"].includes(extension)) {
      return "pdf";
    }

    if (
      ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(extension)
    ) {
      return "image";
    }

    if (
      ["mp4", "avi", "mov", "wmv", "flv", "webm", "mkv", "m4v"].includes(
        extension
      )
    ) {
      return "video";
    }

    if (
      ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"].includes(extension)
    ) {
      return "audio";
    }

    return "file";
  }, []);

  const fileType = getFileType(mediaUrl);

  const generatePreviewUrl = useCallback(async () => {
    if (!mediaUrl) {
      setError("No media URL provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (onLoadStart) {
        onLoadStart();
      }

      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        setPreviewUrl(mediaUrl);
        setLoading(false);
        if (onLoadComplete) {
          onLoadComplete();
        }
        return;
      }

      const baseUrl = getBackendURL();
      const apiUrl = `${baseUrl}/public/${mediaUrl}`;

      console.log("MediaPreview Debug:", {
        baseUrl,
        apiUrl,
        mediaUrl,
        windowOrigin: window.location.origin,
        configCheck: "Should be localhost:8080",
      });

      setPreviewUrl(apiUrl);
      setLoading(false);

      if (onLoadComplete) {
        onLoadComplete();
      }
    } catch (err) {
      setError(err.message || "Failed to load preview");
      setLoading(false);
      if (onError) {
        onError(err);
      }
    }
  }, [mediaUrl, onLoadStart, onLoadComplete, onError]);

  const handleRetry = useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount((prev) => prev + 1);
      generatePreviewUrl();
    }
  }, [retryCount, generatePreviewUrl]);

  const handleImageError = useCallback(() => {
    setError("Failed to load image");
    if (onError) {
      onError(new Error("Image load failed"));
    }
  }, [onError]);

  const handleImageLoad = useCallback(() => {
    setError(null);
    if (onLoadComplete) {
      onLoadComplete();
    }
  }, [onLoadComplete]);

  useEffect(() => {
    generatePreviewUrl();
  }, [generatePreviewUrl]);

  const sizeClass = classes[size] || classes.medium;
  const accessibleAlt = alt || `Media preview for ${mediaUrl || "file"}`;

  // Handle PDF files with PdfPreview component
  if (fileType === "pdf" && previewUrl) {
    return (
      <PdfPreview
        pdfUrl={previewUrl}
        size={size}
        onLoadStart={onLoadStart}
        onLoadComplete={onLoadComplete}
        onError={onError}
        {...props}
      />
    );
  }

  if (loading) {
    return (
      <div
        className={`${classes.container} ${sizeClass}`}
        role="img"
        aria-label="Loading media preview"
      >
        <div className={classes.loadingContainer}>
          <CircularProgress size={size === "thumbnail" ? 24 : 40} />
        </div>
      </div>
    );
  }

  if (error) {
    if (fallbackComponent) {
      return (
        <div className={`${classes.container} ${sizeClass}`}>
          {fallbackComponent}
        </div>
      );
    }

    return (
      <div
        className={`${classes.container} ${sizeClass}`}
        role="img"
        aria-label={`Failed to load media: ${error}`}
      >
        <div className={classes.errorContainer}>
          <BrokenImageIcon className={classes.icon} />
          <Typography variant="caption" align="center">
            {size === "thumbnail" ? "Error" : "Failed to load"}
          </Typography>
          {retryCount < MAX_RETRIES && (
            <Tooltip title="Retry loading">
              <IconButton
                className={classes.retryButton}
                size="small"
                onClick={handleRetry}
                aria-label="Retry loading media"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className={`${classes.container} ${sizeClass}`}>
        <img
          src={previewUrl}
          alt={accessibleAlt}
          className={classes.image}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
          {...props}
        />
      </div>
    );
  }

  return (
    <div
      className={`${classes.container} ${sizeClass}`}
      role="img"
      aria-label="Media file placeholder"
    >
      <div className={classes.placeholder}>
        <FileIcon className={classes.icon} />
        <Typography variant="caption">
          {size === "thumbnail" ? "File" : "Media File"}
        </Typography>
      </div>
    </div>
  );
};

export default MediaPreview;
