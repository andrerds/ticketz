import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";
import { DIALOG_DIMENSIONS } from "../constants";
import { formatBytes } from "../utils/formatters";

const useStyles = makeStyles(() => ({
  debugDialog: {
    minWidth: DIALOG_DIMENSIONS.S3_DEBUG_MIN_WIDTH,
  },
  debugTable: {
    maxHeight: DIALOG_DIMENSIONS.S3_DEBUG_TABLE_MAX_HEIGHT,
    overflow: "auto",
  },
}));

const S3DebugDialog = ({ open, data, onClose }) => {
  const classes = useStyles();

  if (!data) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>S3 Debug Information</DialogTitle>
      <DialogContent className={classes.debugDialog}>
        <Grid container spacing={2} style={{ marginBottom: 16 }}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="textSecondary">
              Bucket Name
            </Typography>
            <Typography variant="h6">{data.bucketName}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="textSecondary">
              Total Files
            </Typography>
            <Typography variant="h6">{data.totalFiles}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body2" color="textSecondary">
              Total Size
            </Typography>
            <Typography variant="h6">{formatBytes(data.totalSize)}</Typography>
          </Grid>
          {data.prefix && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Prefix
              </Typography>
              <Typography variant="body1">{data.prefix}</Typography>
            </Grid>
          )}
        </Grid>

        <Typography variant="h6" gutterBottom>
          Files in S3
        </Typography>
        <div className={classes.debugTable}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Last Modified</TableCell>
                <TableCell>ETag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.files.map((file, index) => (
                <TableRow key={index}>
                  <TableCell style={{ wordBreak: "break-all" }}>
                    {file.key}
                  </TableCell>
                  <TableCell>{formatBytes(file.size)}</TableCell>
                  <TableCell>
                    {format(new Date(file.lastModified), "dd/MM/yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell
                    style={{ fontFamily: "monospace", fontSize: "0.8em" }}
                  >
                    {file.etag}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default S3DebugDialog;
