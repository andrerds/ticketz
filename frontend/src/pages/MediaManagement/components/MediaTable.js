import {
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import DeleteIcon from "@material-ui/icons/Delete";
import { format } from "date-fns";
import MediaPreview from "../../../components/MediaPreview";
import { i18n } from "../../../translate/i18n";
import { formatBytes } from "../utils/formatters";
const useStyles = makeStyles((theme) => ({
  deleteButton: {
    color: theme.palette.error.main,
  },
  previewCell: {
    width: 80,
    padding: theme.spacing(1),
  },
}));

const MediaTable = ({
  mediaFiles,
  selectedFiles,
  onSelectFile,
  onSelectAll,
  onDeleteClick,
}) => {
  const classes = useStyles();

  const deletableFiles = mediaFiles.filter((f) => f.canDelete);
  const isAllSelected =
    selectedFiles.length > 0 && selectedFiles.length === deletableFiles.length;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell padding="checkbox">
            <Checkbox checked={isAllSelected} onChange={onSelectAll} />
          </TableCell>
          <TableCell>{i18n.t("mediaManagement.table.preview")}</TableCell>
          <TableCell>{i18n.t("mediaManagement.table.fileName")}</TableCell>
          <TableCell>{i18n.t("mediaManagement.table.fileSize")}</TableCell>
          <TableCell>{i18n.t("mediaManagement.table.uploadDate")}</TableCell>
          <TableCell>{i18n.t("mediaManagement.table.fileType")}</TableCell>
          <TableCell>{i18n.t("mediaManagement.table.location")}</TableCell>
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
                  onChange={() => onSelectFile(file.messageId)}
                />
              )}
            </TableCell>
            <TableCell className={classes.previewCell}>
              <MediaPreview
                mediaUrl={file.mediaUrl}
                size="thumbnail"
                alt={`Preview of ${file.fileName}`}
              />
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
                  onClick={() => onDeleteClick(file)}
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
  );
};

export default MediaTable;
