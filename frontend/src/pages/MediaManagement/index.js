import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { BugReport, Delete as DeleteIcon } from "@material-ui/icons";

import { useEffect, useState } from "react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";

import MediaFilters from "./components/MediaFilters";
import MediaStats from "./components/MediaStats";
import MediaTable from "./components/MediaTable";
import S3DebugDialog from "./components/S3DebugDialog";
import { useDeleteDialog } from "./hooks/useDeleteDialog";
import { useMediaManagement } from "./hooks/useMediaManagement";
import { useS3Debug } from "./hooks/useS3Debug";
import { isDevEnvironment } from "./utils/formatters";

const DEFAULT_FILTERS = {
  startDate: "",
  endDate: "",
  fileType: "",
  storageLocation: "",
};

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  filtersContainer: {
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  debugButton: {
    marginBottom: theme.spacing(2),
  },
  bulkActions: {
    marginBottom: theme.spacing(2),
  },
}));

const MediaManagement = () => {
  const classes = useStyles();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const {
    mediaFiles,
    stats,
    selectedFiles,
    loadMediaFiles,
    loadStats,
    deleteFile,
    bulkDeleteFiles,
    handleSelectFile,
    handleSelectAll,
  } = useMediaManagement();

  const {
    s3DebugOpen,
    s3DebugData,
    s3DebugLoading,
    handleS3Debug,
    closeS3Debug,
  } = useS3Debug();

  const {
    deleteDialogOpen,
    fileToDelete,
    openDeleteDialog,
    closeDeleteDialog,
  } = useDeleteDialog();

  useEffect(() => {
    loadMediaFiles();
    loadStats();
  }, [loadMediaFiles, loadStats]);

  const handleFilterChange = e => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = () => {
    loadMediaFiles(filters);
  };

  const handleDeleteClick = file => {
    openDeleteDialog(file);
  };

  const handleDeleteConfirm = async () => {
    if (fileToDelete) {
      await deleteFile(fileToDelete.messageId);
    }
    closeDeleteDialog();
  };

  const handleBulkDelete = async () => {
    await bulkDeleteFiles(selectedFiles);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("mediaManagement.title")}</Title>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <MediaStats stats={stats} />

        {isDevEnvironment() && (
          <div className={classes.debugButton}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<BugReport />}
              onClick={handleS3Debug}
              disabled={s3DebugLoading}
            >
              {s3DebugLoading ? "Loading..." : "Debug S3 Files"}
            </Button>
          </div>
        )}

        <div className={classes.filtersContainer}>
          <MediaFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onApplyFilters={handleApplyFilters}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className={classes.bulkActions}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              {i18n.t("mediaManagement.buttons.deleteSelected")} (
              {selectedFiles.length})
            </Button>
          </div>
        )}

        <div className={classes.tableContainer}>
          <MediaTable
            mediaFiles={mediaFiles}
            selectedFiles={selectedFiles}
            onSelectFile={handleSelectFile}
            onSelectAll={handleSelectAll}
            onDeleteClick={handleDeleteClick}
          />
        </div>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>
          {i18n.t("mediaManagement.confirmDialog.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {i18n.t("mediaManagement.confirmDialog.message")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} color="primary">
            {i18n.t("mediaManagement.buttons.cancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="secondary">
            {i18n.t("mediaManagement.buttons.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <S3DebugDialog
        open={s3DebugOpen}
        data={s3DebugData}
        onClose={closeS3Debug}
      />
    </MainContainer>
  );
};

export default MediaManagement;
