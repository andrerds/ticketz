import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";
import { i18n } from "../../../translate/i18n";

const MediaFilters = ({ filters, onFilterChange, onApplyFilters }) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={3}>
        <TextField
          fullWidth
          label={i18n.t("mediaManagement.filters.startDate")}
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={onFilterChange}
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
          onChange={onFilterChange}
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} sm={2}>
        <FormControl fullWidth>
          <InputLabel>{i18n.t("mediaManagement.filters.fileType")}</InputLabel>
          <Select
            name="fileType"
            value={filters.fileType}
            onChange={onFilterChange}
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
          <InputLabel>{i18n.t("mediaManagement.filters.location")}</InputLabel>
          <Select
            name="storageLocation"
            value={filters.storageLocation}
            onChange={onFilterChange}
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
          onClick={onApplyFilters}
        >
          {i18n.t("mediaManagement.buttons.filter")}
        </Button>
      </Grid>
    </Grid>
  );
};

export default MediaFilters;
