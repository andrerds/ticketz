import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import DeleteIcon from "@material-ui/icons/Delete";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  statsCard: {
    marginBottom: theme.spacing(2),
  },
  filtersContainer: {
    marginBottom: theme.spacing(2),
  },
  tableContainer: {
    marginTop: theme.spacing(2),
  },
  deleteButton: {
    color: theme.palette.error.main,
  },
}));

const MediaManagement = () => {
  const classes = useStyles();

  const [mediaFiles, setMediaFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    fileType: "",
    storageLocation: "",
  });

  useEffect(() => {
    loadMediaFiles();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMediaFiles = useCallback(async () => {
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.fileType) params.fileType = filters.fileType;
      if (filters.storageLocation)
        params.storageLocation = filters.storageLocation;

      const { data } = await api.get("/media", { params });
      setMediaFiles(data);
    } catch (err) {
      toastError(err);
    }
  }, [filters]);

  const loadStats = async () => {
    try {
      const { data } = await api.get("/media/stats");
      setStats(data);
    } catch (err) {
      toastError(err);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = () => {
    loadMediaFiles();
  };

  const handleSelectFile = (fileId) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === mediaFiles.filter((f) => f.canDelete).length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(
        mediaFiles.filter((f) => f.canDelete).map((f) => f.messageId)
      );
    }
  };

  const handleDeleteClick = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      if (fileToDelete) {
        await api.delete(`/media/${fileToDelete.messageId}`);
        toast.success(i18n.t("mediaManagement.messages.deleteSuccess"));
        loadMediaFiles();
        loadStats();
      }
    } catch (err) {
      toastError(err);
    } finally {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await api.post("/media/bulk-delete", { messageIds: selectedFiles });
      toast.success(i18n.t("mediaManagement.messages.bulkDeleteSuccess"));
      setSelectedFiles([]);
      loadMediaFiles();
      loadStats();
    } catch (err) {
      toastError(err);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("mediaManagement.title")}</Title>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        {stats && (
          <Card className={classes.statsCard}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {i18n.t("mediaManagement.stats.title")}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("mediaManagement.stats.totalFiles")}
                  </Typography>
                  <Typography variant="h5">{stats.totalFiles}</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("mediaManagement.stats.totalSize")}
                  </Typography>
                  <Typography variant="h5">
                    {formatBytes(stats.totalSize)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("mediaManagement.stats.byLocation")}
                  </Typography>
                  <Typography variant="body1">
                    Local: {stats.byLocation.local.count} (
                    {formatBytes(stats.byLocation.local.size)})
                  </Typography>
                  <Typography variant="body1">
                    S3: {stats.byLocation.s3.count} (
                    {formatBytes(stats.byLocation.s3.size)})
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        <div className={classes.filtersContainer}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label={i18n.t("mediaManagement.filters.startDate")}
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label={i18n.t("mediaManagement.filters.endDate")}
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>
                  {i18n.t("mediaManagement.filters.fileType")}
                </InputLabel>
                <Select
                  name="fileType"
                  value={filters.fileType}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">
                    {i18n.t("mediaManagement.filters.all")}
                  </MenuItem>
                  <MenuItem value="image">Image</MenuItem>
                  <MenuItem value="video">Video</MenuItem>
                  <MenuItem value="audio">Audio</MenuItem>
                  <MenuItem value="document">Document</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth>
                <InputLabel>
                  {i18n.t("mediaManagement.filters.location")}
                </InputLabel>
                <Select
                  name="storageLocation"
                  value={filters.storageLocation}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">
                    {i18n.t("mediaManagement.filters.all")}
                  </MenuItem>
                  <MenuItem value="local">Local</MenuItem>
                  <MenuItem value="s3">S3</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={handleApplyFilters}
              >
                {i18n.t("mediaManagement.buttons.filter")}
              </Button>
            </Grid>
          </Grid>
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: 16 }}>
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={
                      selectedFiles.length > 0 &&
                      selectedFiles.length ===
                        mediaFiles.filter((f) => f.canDelete).length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>
                  {i18n.t("mediaManagement.table.fileName")}
                </TableCell>
                <TableCell>
                  {i18n.t("mediaManagement.table.fileSize")}
                </TableCell>
                <TableCell>
                  {i18n.t("mediaManagement.table.uploadDate")}
                </TableCell>
                <TableCell>
                  {i18n.t("mediaManagement.table.fileType")}
                </TableCell>
                <TableCell>
                  {i18n.t("mediaManagement.table.location")}
                </TableCell>
                <TableCell>{i18n.t("mediaManagement.table.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mediaFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell padding="checkbox">
                    {file.canDelete && (
                      <Checkbox
                        checked={selectedFiles.includes(file.messageId)}
                        onChange={() => handleSelectFile(file.messageId)}
                      />
                    )}
                  </TableCell>
                  <TableCell>{file.fileName}</TableCell>
                  <TableCell>{formatBytes(file.fileSize)}</TableCell>
                  <TableCell>
                    {format(new Date(file.uploadDate), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>{file.fileType}</TableCell>
                  <TableCell>{file.storageLocation}</TableCell>
                  <TableCell>
                    {file.canDelete ? (
                      <IconButton
                        size="small"
                        className={classes.deleteButton}
                        onClick={() => handleDeleteClick(file)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        {i18n.t("mediaManagement.messages.protected")}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Paper>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {i18n.t("mediaManagement.confirmDialog.title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {i18n.t("mediaManagement.confirmDialog.message")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            {i18n.t("mediaManagement.buttons.cancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="secondary">
            {i18n.t("mediaManagement.buttons.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default MediaManagement;
