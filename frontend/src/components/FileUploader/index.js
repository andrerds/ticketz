import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Cancel, CloudUpload } from "@material-ui/icons";
import React from "react";
import { useMultipartUpload } from "../../hooks/useMultipartUpload";

const useStyles = makeStyles(theme => ({
  root: {
    width: "100%",
  },
  input: {
    display: "none",
  },
  uploadButton: {
    marginTop: theme.spacing(1),
  },
  progressContainer: {
    marginTop: theme.spacing(2),
    width: "100%",
  },
  progressBar: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelButton: {
    marginLeft: theme.spacing(1),
  },
}));

const FileUploader = ({
  onUploadComplete,
  disabled = false,
  buttonText = "Upload File",
}) => {
  const classes = useStyles();
  const { uploadFile, cancelUpload, uploading, progress, currentFile } =
    useMultipartUpload();

  const handleFileSelect = async event => {
    const file = event.target.files[0];
    if (!file) return;

    // Clear the input so the same file can be selected again
    event.target.value = null;

    const result = await uploadFile(file);
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
  };

  const handleCancel = () => {
    cancelUpload();
  };

  return (
    <Box className={classes.root}>
      <input
        accept="*/*"
        className={classes.input}
        id="multipart-file-upload"
        type="file"
        onChange={handleFileSelect}
        disabled={uploading || disabled}
      />
      <label htmlFor="multipart-file-upload">
        <Button
          variant="contained"
          color="primary"
          component="span"
          startIcon={<CloudUpload />}
          disabled={uploading || disabled}
          className={classes.uploadButton}
        >
          {uploading ? "Uploading..." : buttonText}
        </Button>
      </label>

      {uploading && currentFile && (
        <Box className={classes.progressContainer}>
          <Box className={classes.fileInfo}>
            <Typography variant="body2" color="textSecondary">
              {currentFile}
            </Typography>
            <IconButton
              size="small"
              onClick={handleCancel}
              className={classes.cancelButton}
              title="Cancel upload"
            >
              <Cancel />
            </IconButton>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            className={classes.progressBar}
          />
          <Typography variant="caption" color="textSecondary">
            {progress}% complete
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FileUploader;
