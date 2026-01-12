import {
  Avatar,
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import {
  FaDropbox,
  FaFile,
  FaImage,
  FaSoundcloud,
  FaTrash,
  FaVideo,
} from "react-icons/fa";
import { getBackendURL } from "../../../services/config";
import { i18n } from "../../../translate/i18n";
import { formatBytes } from "../utils/formatters";
import MediaViewerModal from "./MediaViewerModal";

const useStyles = makeStyles(theme => ({
  deleteButton: {
    color: theme.palette.error.main,
  },
  previewCell: {
    width: 100,
    padding: theme.spacing(1),
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(3),
  },
  totalCount: {
    padding: theme.spacing(2),
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  tableContainer: {
    overflowX: "auto",
  },
  previewImage: {
    width: 60,
    height: 60,
    objectFit: "cover",
    borderRadius: theme.spacing(1),
    cursor: "pointer",
    transition: "transform 0.2s",
    "&:hover": {
      transform: "scale(1.1)",
    },
  },
  previewIcon: {
    width: 60,
    height: 60,
    backgroundColor: theme.palette.grey[200],
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover": {
      backgroundColor: theme.palette.primary.light,
      "& .MuiSvgIcon-root": {
        color: theme.palette.common.white,
      },
    },
  },
  fileNameCell: {
    maxWidth: 250,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    "&:hover": {
      color: theme.palette.primary.main,
      textDecoration: "underline",
    },
  },
  locationChip: {
    fontWeight: 600,
  },
  actionButtons: {
    display: "flex",
    gap: theme.spacing(0.5),
  },
  viewButton: {
    color: theme.palette.primary.main,
  },
  tableRow: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  emptyState: {
    padding: theme.spacing(6),
    textAlign: "center",
  },
}));

const MediaTable = ({
  mediaFiles,
  selectedFiles,
  onSelectFile,
  onSelectAll,
  onDeleteClick,
  pagination,
  onLoadMore,
}) => {
  const classes = useStyles();
  const loadMoreRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [failedImages, setFailedImages] = useState(new Set());

  const deletableFiles = mediaFiles.filter(f => f.canDelete);
  const isAllSelected =
    selectedFiles.length > 0 && selectedFiles.length === deletableFiles.length;

  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (
          entries[0].isIntersecting &&
          pagination?.hasMore &&
          !pagination?.loading
        ) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [onLoadMore, pagination?.hasMore, pagination?.loading]);

  const handleViewFile = file => {
    setSelectedFile(file);
    setViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    setSelectedFile(null);
  };

  const handleDeleteFromViewer = file => {
    handleCloseViewer();
    onDeleteClick(file);
  };

  const getFileIcon = fileType => {
    const type = fileType?.toLowerCase() || "";
    if (type.includes("image")) return <FaImage />;
    if (type.includes("video")) return <FaVideo />;
    if (type.includes("audio")) return <FaSoundcloud />;
    return <FaFile />;
  };

  const renderPreview = file => {
    const fileType = file.fileType?.toLowerCase() || "";
    const imageKey = file.mediaUrl;

    if (fileType.includes("image") && !failedImages.has(imageKey)) {
      const imageUrl = file.mediaUrl.startsWith("http")
        ? file.mediaUrl
        : `${getBackendURL()}/public/${file.mediaUrl}`;

      return (
        <img
          src={imageUrl}
          alt={file.fileName}
          className={classes.previewImage}
          onClick={() => handleViewFile(file)}
          onError={() => {
            setFailedImages(prev => new Set([...prev, imageKey]));
          }}
        />
      );
    }

    return (
      <Avatar
        className={classes.previewIcon}
        onClick={() => handleViewFile(file)}
      >
        {getFileIcon(file.fileType)}
      </Avatar>
    );
  };

  return (
    <>
      {pagination?.total > 0 && (
        <Typography variant="body2" className={classes.totalCount}>
          {i18n.t("mediaManagement.table.showing")} {mediaFiles.length}{" "}
          {i18n.t("mediaManagement.table.of")} {pagination.total}{" "}
          {i18n.t("mediaManagement.table.files")}
        </Typography>
      )}

      <Box className={classes.tableContainer}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox checked={isAllSelected} onChange={onSelectAll} />
              </TableCell>
              <TableCell>{i18n.t("mediaManagement.table.preview")}</TableCell>
              <TableCell>{i18n.t("mediaManagement.table.fileName")}</TableCell>
              <TableCell>{i18n.t("mediaManagement.table.fileSize")}</TableCell>
              <TableCell>
                {i18n.t("mediaManagement.table.uploadDate")}
              </TableCell>
              <TableCell>{i18n.t("mediaManagement.table.fileType")}</TableCell>
              <TableCell>{i18n.t("mediaManagement.table.location")}</TableCell>
              <TableCell>{i18n.t("mediaManagement.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mediaFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Box className={classes.emptyState}>
                    <Typography variant="h6" color="textSecondary">
                      {i18n.t("mediaManagement.table.noFiles")}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              mediaFiles.map((file, index) => (
                <TableRow
                  key={`${file.mediaUrl}-${index}`}
                  className={classes.tableRow}
                >
                  <TableCell padding="checkbox">
                    {file.canDelete && (
                      <Checkbox
                        checked={selectedFiles.includes(file.messageId)}
                        onChange={() => onSelectFile(file.messageId)}
                      />
                    )}
                  </TableCell>
                  <TableCell className={classes.previewCell}>
                    {renderPreview(file)}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={file?.fileName ?? ""}>
                      <Typography
                        className={classes.fileNameCell}
                        onClick={() => handleViewFile(file)}
                      >
                        {file.fileName}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{formatBytes(file.fileSize)}</TableCell>
                  <TableCell>
                    {format(new Date(file.uploadDate), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>{file.fileType}</TableCell>
                  <TableCell>
                    <Chip
                      label={file.storageLocation.toUpperCase()}
                      size="small"
                      color={
                        file.storageLocation === "s3" ? "primary" : "default"
                      }
                      className={classes.locationChip}
                    />
                  </TableCell>
                  <TableCell>
                    <Box className={classes.actionButtons}>
                      <Tooltip title={i18n.t("mediaManagement.table.view")}>
                        <IconButton
                          size="small"
                          className={classes.viewButton}
                          onClick={() => handleViewFile(file)}
                        >
                          <FaDropbox />
                        </IconButton>
                      </Tooltip>
                      {file.canDelete ? (
                        <Tooltip title={i18n.t("mediaManagement.table.delete")}>
                          <IconButton
                            size="small"
                            className={classes.deleteButton}
                            onClick={() => onDeleteClick(file)}
                          >
                            <FaTrash />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip
                          title={i18n.t("mediaManagement.messages.protected")}
                        >
                          <span>
                            <IconButton size="small" disabled>
                              <FaTrash />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      {pagination?.hasMore && (
        <Box ref={loadMoreRef} className={classes.loadingContainer}>
          {pagination?.loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("mediaManagement.table.scrollToLoadMore")}
            </Typography>
          )}
        </Box>
      )}

      <MediaViewerModal
        open={viewerOpen}
        file={selectedFile}
        onClose={handleCloseViewer}
        onDelete={handleDeleteFromViewer}
      />
    </>
  );
};

export default MediaTable;
