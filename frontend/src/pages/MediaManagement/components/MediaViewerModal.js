import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
} from "@material-ui/icons";
import { format } from "date-fns";
import { i18n } from "../../../translate/i18n";
import { formatBytes } from "../utils/formatters";

const useStyles = makeStyles(theme => ({
  dialog: {
    "& .MuiDialog-paper": {
      maxWidth: "90vw",
      maxHeight: "90vh",
      margin: theme.spacing(2),
    },
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  titleContent: {
    flex: 1,
    marginRight: theme.spacing(2),
  },
  actions: {
    display: "flex",
    gap: theme.spacing(1),
  },
  dialogContent: {
    padding: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  mediaContainer: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    minHeight: 400,
    position: "relative",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "70vh",
    objectFit: "contain",
  },
  video: {
    maxWidth: "100%",
    maxHeight: "70vh",
  },
  audio: {
    width: "100%",
    maxWidth: 600,
  },
  infoContainer: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.paper,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1.5),
    "&:last-child": {
      marginBottom: 0,
    },
  },
  infoLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    minWidth: 120,
  },
  infoValue: {
    color: theme.palette.text.primary,
    flex: 1,
    textAlign: "right",
    wordBreak: "break-all",
  },
  locationChip: {
    marginLeft: theme.spacing(1),
  },
  documentContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(6),
    minHeight: 400,
  },
  documentIcon: {
    fontSize: 80,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2),
  },
}));

const MediaViewerModal = ({ open, file, onClose, onDelete }) => {
  const classes = useStyles();

  if (!file) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = file.mediaUrl;
    link.download = file.fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMedia = () => {
    const fileType = file.fileType?.toLowerCase() || "";

    if (fileType.includes("image")) {
      return (
        <img
          src={file.mediaUrl}
          alt={file.fileName}
          className={classes.image}
        />
      );
    }

    if (fileType.includes("video")) {
      return (
        <video controls className={classes.video}>
          <source src={file.mediaUrl} />
          {i18n.t("mediaManagement.viewer.videoNotSupported")}
        </video>
      );
    }

    if (fileType.includes("audio")) {
      return (
        <audio controls className={classes.audio}>
          <source src={file.mediaUrl} />
          {i18n.t("mediaManagement.viewer.audioNotSupported")}
        </audio>
      );
    }

    return (
      <Box className={classes.documentContainer}>
        <DownloadIcon className={classes.documentIcon} />
        <Typography variant="h6" gutterBottom>
          {file.fileName}
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {i18n.t("mediaManagement.viewer.downloadToView")}
        </Typography>
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      className={classes.dialog}
    >
      <DialogTitle className={classes.dialogTitle} disableTypography>
        <Box className={classes.titleContent}>
          <Typography variant="h6" noWrap>
            {file.fileName}
          </Typography>
        </Box>
        <Box className={classes.actions}>
          <IconButton
            size="small"
            onClick={handleDownload}
            title={i18n.t("mediaManagement.viewer.download")}
          >
            <DownloadIcon />
          </IconButton>
          {file.canDelete && onDelete && (
            <IconButton
              size="small"
              onClick={() => onDelete(file)}
              title={i18n.t("mediaManagement.viewer.delete")}
              color="secondary"
            >
              <DeleteIcon />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        <Box className={classes.mediaContainer}>{renderMedia()}</Box>

        <Box className={classes.infoContainer}>
          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>
              {i18n.t("mediaManagement.viewer.fileSize")}:
            </Typography>
            <Typography className={classes.infoValue}>
              {formatBytes(file.fileSize)}
            </Typography>
          </Box>

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>
              {i18n.t("mediaManagement.viewer.uploadDate")}:
            </Typography>
            <Typography className={classes.infoValue}>
              {format(new Date(file.uploadDate), "dd/MM/yyyy HH:mm:ss")}
            </Typography>
          </Box>

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>
              {i18n.t("mediaManagement.viewer.fileType")}:
            </Typography>
            <Typography className={classes.infoValue}>
              {file.fileType}
            </Typography>
          </Box>

          <Box className={classes.infoRow}>
            <Typography className={classes.infoLabel}>
              {i18n.t("mediaManagement.viewer.location")}:
            </Typography>
            <Box className={classes.infoValue}>
              <Chip
                label={file.storageLocation.toUpperCase()}
                size="small"
                color={file.storageLocation === "s3" ? "primary" : "default"}
                className={classes.locationChip}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewerModal;
