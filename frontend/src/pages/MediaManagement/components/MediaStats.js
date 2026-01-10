import { Card, CardContent, Grid, Typography } from "@material-ui/core";
import { i18n } from "../../../translate/i18n";
import { formatBytes } from "../utils/formatters";

const MediaStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <Card>
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
            <Typography variant="h5">{formatBytes(stats.totalSize)}</Typography>
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
  );
};

export default MediaStats;
