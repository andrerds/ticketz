import {
  Box,
  Chip,
  Dialog,
  IconButton,
  Slide,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  MusicNote as AudioIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  PictureAsPdf as PdfIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from "@material-ui/icons";
import { format } from "date-fns";
import { forwardRef, useState } from "react";
import { getBackendURL } from "../../../services/config";
import { i18n } from "../../../translate/i18n";
import { formatBytes } from "../utils/formatters";

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const useStyles = makeStyles(theme => ({
  dialog: {
    "& .MuiDialog-paper": {
      backgroundColor: "rgba(0, 0, 0, 0.95)",
      margin: 0,
      maxWidth: "100%",
      maxHeight: "100%",
      width: "100%",
      height: "100%",
      borderRadius: 0,
    },
  },
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    zIndex: 10,
  },
  headerInfo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flex: 1,
    overflow: "hidden",
  },
  fileName: {
    color: "#fff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(0.5),
  },
  iconButton: {
    color: "#fff",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
  },
  deleteButton: {
    color: theme.palette.error.light,
    "&:hover": {
      backgroundColor: "rgba(244, 67, 54, 0.1)",
    },
  },
  mediaContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "auto",
    padding: theme.spacing(2),
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    transition: "transform 0.3s ease",
    cursor: "zoom-in",
  },
  imageZoomed: {
    cursor: "zoom-out",
  },
  video: {
    maxWidth: "100%",
    maxHeight: "100%",
    outline: "none",
  },
  audioContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    width: "100%",
    maxWidth: 600,
  },
  audioIcon: {
    fontSize: 120,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(3),
  },
  audioFileName: {
    color: "#fff",
    marginBottom: theme.spacing(3),
    textAlign: "center",
  },
  audio: {
    width: "100%",
  },
  pdfContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#525659",
  },
  pdfEmbed: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  pdfFallback: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: theme.spacing(4),
  },
  pdfIcon: {
    fontSize: 120,
    color: "#dc3545",
    marginBottom: theme.spacing(2),
  },
  documentContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
  documentIcon: {
    fontSize: 120,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    gap: theme.spacing(3),
    flexWrap: "wrap",
  },
  footerItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    fontSize: "0.85rem",
  },
  footerLabel: {
    color: "rgba(255, 255, 255, 0.6)",
  },
  footerValue: {
    color: "#fff",
  },
  locationChip: {
    height: 24,
  },
}));

const MediaViewerModal = ({ open, file, onClose, onDelete }) => {
  const classes = useStyles();
  const [zoom, setZoom] = useState(1);

  if (!file) return null;

  const getMediaUrl = mediaUrl => {
    if (!mediaUrl) return "";
    if (mediaUrl.startsWith("http")) return mediaUrl;
    return `${getBackendURL()}/public/${mediaUrl}`;
  };

  const mediaUrl = getMediaUrl(file.mediaUrl);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = mediaUrl;
    link.download = file.fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomToggle = () => {
    setZoom(prev => (prev === 1 ? 2 : 1));
  };

  const handleClose = () => {
    setZoom(1);
    onClose();
  };

  const renderMedia = () => {
    const fileType = file.fileType?.toLowerCase() || "";
    const fileName = file.fileName?.toLowerCase() || "";

    if (fileType.includes("image")) {
      return (
        <img
          src={mediaUrl}
          alt={file.fileName}
          className={`${classes.image} ${zoom > 1 ? classes.imageZoomed : ""}`}
          style={{ transform: `scale(${zoom})` }}
          onClick={handleZoomToggle}
        />
      );
    }

    if (fileType.includes("video")) {
      return (
        <video controls className={classes.video} autoPlay={false}>
          <source src={mediaUrl} type={fileType} />
          {i18n.t("mediaManagement.viewer.videoNotSupported")}
        </video>
      );
    }

    if (fileType.includes("audio")) {
      return (
        <Box className={classes.audioContainer}>
          <AudioIcon className={classes.audioIcon} />
          <Typography variant="h6" className={classes.audioFileName}>
            {file.fileName}
          </Typography>
          <audio controls className={classes.audio} autoPlay={false}>
            <source src={mediaUrl} type={fileType} />
            {i18n.t("mediaManagement.viewer.audioNotSupported")}
          </audio>
        </Box>
      );
    }

    if (fileType.includes("pdf") || fileName.endsWith(".pdf")) {
      return (
        <Box className={classes.pdfContainer}>
          <object
            data={mediaUrl}
            type="application/pdf"
            className={classes.pdfEmbed}
          >
            <Box className={classes.pdfFallback}>
              <PdfIcon className={classes.pdfIcon} />
              <Typography variant="h5" style={{ color: "#fff" }} gutterBottom>
                {file.fileName}
              </Typography>
              <Typography
                variant="body1"
                style={{ color: "rgba(255,255,255,0.7)" }}
                gutterBottom
              >
                Não foi possível exibir o PDF
              </Typography>
              <IconButton
                className={classes.iconButton}
                onClick={handleDownload}
              >
                <DownloadIcon style={{ marginRight: 8 }} /> Download
              </IconButton>
            </Box>
          </object>
        </Box>
      );
    }

    return (
      <Box className={classes.documentContainer}>
        <DownloadIcon className={classes.documentIcon} />
        <Typography variant="h5" style={{ color: "#fff" }} gutterBottom>
          {file.fileName}
        </Typography>
        <Typography
          variant="body1"
          style={{ color: "rgba(255,255,255,0.7)" }}
          gutterBottom
        >
          {i18n.t("mediaManagement.viewer.downloadToView")}
        </Typography>
      </Box>
    );
  };

  const fileType = file.fileType?.toLowerCase() || "";
  const isImage = fileType.includes("image");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      TransitionComponent={Transition}
      className={classes.dialog}
    >
      <Box className={classes.container}>
        <Box className={classes.header}>
          <Box className={classes.headerInfo}>
            <Typography variant="subtitle1" className={classes.fileName}>
              {file.fileName}
            </Typography>
          </Box>
          <Box className={classes.headerActions}>
            {isImage && (
              <IconButton
                className={classes.iconButton}
                onClick={handleZoomToggle}
                title={zoom > 1 ? "Zoom out" : "Zoom in"}
              >
                {zoom > 1 ? <ZoomOutIcon /> : <ZoomInIcon />}
              </IconButton>
            )}
            <IconButton
              className={classes.iconButton}
              onClick={handleDownload}
              title={i18n.t("mediaManagement.viewer.download")}
            >
              <DownloadIcon />
            </IconButton>
            {file.canDelete && onDelete && (
              <IconButton
                className={classes.deleteButton}
                onClick={() => onDelete(file)}
                title={i18n.t("mediaManagement.viewer.delete")}
              >
                <DeleteIcon />
              </IconButton>
            )}
            <IconButton className={classes.iconButton} onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Box className={classes.mediaContainer}>{renderMedia()}</Box>

        <Box className={classes.footer}>
          <Box className={classes.footerItem}>
            <span className={classes.footerLabel}>Tamanho:</span>
            <span className={classes.footerValue}>
              {formatBytes(file.fileSize)}
            </span>
          </Box>
          <Box className={classes.footerItem}>
            <span className={classes.footerLabel}>Data:</span>
            <span className={classes.footerValue}>
              {format(new Date(file.uploadDate), "dd/MM/yyyy HH:mm")}
            </span>
          </Box>
          <Box className={classes.footerItem}>
            <span className={classes.footerLabel}>Tipo:</span>
            <span className={classes.footerValue}>{file.fileType}</span>
          </Box>
          <Chip
            label={file.storageLocation.toUpperCase()}
            size="small"
            color={file.storageLocation === "s3" ? "primary" : "default"}
            className={classes.locationChip}
          />
        </Box>
      </Box>
    </Dialog>
  );
};

export default MediaViewerModal;
