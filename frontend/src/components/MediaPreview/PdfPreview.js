import { CircularProgress, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { PictureAsPdf as PdfIcon } from "@material-ui/icons";
import { useCallback, useEffect, useState } from "react";

const useStyles = makeStyles((theme) => ({
  container: {
    position: "relative",
    display: "inline-block",
    borderRadius: theme.spacing(1),
    overflow: "hidden",
    backgroundColor: theme.palette.grey[100],
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
    padding: theme.spacing(2),
    minHeight: 120,
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.contrastText,
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(2),
    minHeight: 120,
    backgroundColor: "#dc3545", // PDF red color
    color: "white",
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
    maxHeight: 300,
  },
  full: {
    width: "100%",
    maxWidth: 400,
  },
  pdfEmbed: {
    width: "100%",
    height: "100%",
    minHeight: 200,
    border: "none",
  },
}));

const PdfPreview = ({
  pdfUrl,
  size = "medium",
  onLoadStart,
  onLoadComplete,
  onError,
  ...props
}) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);

  const sizeClass = classes[size] || classes.medium;

  useEffect(() => {
    if (onLoadStart) {
      onLoadStart();
    }

    // Simulate loading completion
    setTimeout(() => {
      setLoading(false);
      if (onLoadComplete) {
        onLoadComplete();
      }
    }, 100);
  }, [pdfUrl, onLoadStart, onLoadComplete]);

  const handlePdfClick = useCallback(() => {
    // Open PDF in new tab
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  if (loading) {
    return (
      <div
        className={`${classes.container} ${sizeClass}`}
        role="img"
        aria-label="Loading PDF preview"
      >
        <div className={classes.loadingContainer}>
          <CircularProgress size={size === "thumbnail" ? 24 : 40} />
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div
        className={`${classes.container} ${sizeClass}`}
        role="img"
        aria-label="PDF placeholder"
      >
        <div className={classes.placeholder}>
          <PdfIcon className={classes.icon} />
          <Typography variant="caption">
            {size === "thumbnail" ? "PDF" : "PDF Document"}
          </Typography>
        </div>
      </div>
    );
  }

  // For now, show a clickable PDF placeholder
  // This will be upgraded when React is updated to 18+
  return (
    <div
      className={`${classes.container} ${sizeClass}`}
      role="button"
      aria-label="PDF document - click to open"
      onClick={handlePdfClick}
      style={{ cursor: "pointer" }}
      {...props}
    >
      <div className={classes.placeholder}>
        <PdfIcon className={classes.icon} />
        <Typography variant="caption" align="center">
          {size === "thumbnail" ? "PDF" : "PDF Document"}
        </Typography>
        <Typography
          variant="caption"
          align="center"
          style={{ fontSize: "0.7rem", marginTop: 4 }}
        >
          Click to open
        </Typography>
      </div>
    </div>
  );
};

export default PdfPreview;
