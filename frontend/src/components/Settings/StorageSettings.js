import {
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const MASKED_SECRET = "*****";
const STORAGE_API_ENDPOINT = "/settings/storage";
const STORAGE_TEST_ENDPOINT = "/settings/storage/test";

const useStyles = makeStyles(theme => ({
  fieldContainer: {
    width: "100%",
    textAlign: "left",
  },
  groupTitle: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  saveButton: {
    marginTop: theme.spacing(2),
  },
  buttonSpacing: {
    marginRight: theme.spacing(2),
  },
}));

export default function StorageSettings() {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [driver, setDriver] = useState("local");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [forcePathStyle, setForcePathStyle] = useState(false);

  const [imageOptimizationEnabled, setImageOptimizationEnabled] =
    useState(false);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [quality, setQuality] = useState(80);
  const [maxBytes, setMaxBytes] = useState(1048576);

  useEffect(() => {
    loadStorageSettings();
  }, []);

  const loadStorageSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(STORAGE_API_ENDPOINT);

      setDriver(data.driver || "local");

      if (data.s3Config) {
        setEndpoint(data.s3Config.endpoint || "");
        setRegion(data.s3Config.region || "");
        setBucket(data.s3Config.bucket || "");
        setAccessKeyId(data.s3Config.accessKeyId || "");
        setSecretAccessKey(data.s3Config.secretAccessKey || "");
        setPrefix(data.s3Config.prefix || "");
        setForcePathStyle(data.s3Config.forcePathStyle || false);
      }

      if (data.imageOptimization) {
        setImageOptimizationEnabled(data.imageOptimization.enabled || false);
        setMaxWidth(data.imageOptimization.maxWidth || 1920);
        setQuality(data.imageOptimization.quality || 80);
        setMaxBytes(data.imageOptimization.maxBytes || 1048576);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const validateS3Fields = () => {
    if (!endpoint || !region || !bucket || !accessKeyId) {
      toast.error("Please fill in all required S3 fields");
      return false;
    }

    if (!secretAccessKey || secretAccessKey === MASKED_SECRET) {
      toast.error("Please provide the S3 secret access key");
      return false;
    }

    return true;
  };

  const buildS3Config = () => ({
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix,
    forcePathStyle,
  });

  const buildImageOptimizationConfig = () => ({
    enabled: imageOptimizationEnabled,
    maxWidth: parseInt(maxWidth, 10),
    quality: parseInt(quality, 10),
    maxBytes: parseInt(maxBytes, 10),
  });

  const buildStoragePayload = () => {
    const payload = {
      driver,
      imageOptimization: buildImageOptimizationConfig(),
    };

    if (driver === "s3") {
      payload.s3Config = buildS3Config();
    }

    return payload;
  };

  const handleSave = async () => {
    if (driver === "s3" && !validateS3Fields()) {
      return;
    }

    setSaving(true);
    try {
      const payload = buildStoragePayload();
      await api.put(STORAGE_API_ENDPOINT, payload);
      toast.success("Storage configuration updated successfully");
      await loadStorageSettings();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (driver === "s3" && !validateS3Fields()) {
      return;
    }

    setTesting(true);
    try {
      const payload = buildStoragePayload();
      const { data } = await api.post(STORAGE_TEST_ENDPOINT, payload);

      if (data.valid) {
        toast.success(data.message || "Connection test successful!");
      } else {
        toast.error(data.message || "Connection test failed");
      }
    } catch (err) {
      toastError(err);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Grid container justifyContent="center">
        <CircularProgress />
      </Grid>
    );
  }

  return (
    <>
      <Grid spacing={3} container>
        <Grid item xs={12}>
          <h2 className={classes.groupTitle}>Storage Driver</h2>
        </Grid>

        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.fieldContainer}>
            <InputLabel id="storage-driver-label">Storage Driver</InputLabel>
            <Select
              labelId="storage-driver-label"
              value={driver}
              onChange={e => setDriver(e.target.value)}
            >
              <MenuItem value="local">Local Filesystem</MenuItem>
              <MenuItem value="s3">S3-Compatible Storage</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        {driver === "s3" && (
          <>
            <Grid item xs={12}>
              <h2 className={classes.groupTitle}>S3 Configuration</h2>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Endpoint *"
                  placeholder="https://s3.amazonaws.com"
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Region *"
                  placeholder="us-east-1"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Bucket *"
                  placeholder="my-bucket"
                  value={bucket}
                  onChange={e => setBucket(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Access Key ID *"
                  value={accessKeyId}
                  onChange={e => setAccessKeyId(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Secret Access Key *"
                  type={showSecretKey ? "text" : "password"}
                  value={secretAccessKey}
                  onChange={e => setSecretAccessKey(e.target.value)}
                  variant="standard"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          edge="end"
                        >
                          {showSecretKey ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Prefix (optional)"
                  placeholder="media"
                  value={prefix}
                  onChange={e => setPrefix(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={forcePathStyle}
                      onChange={e => setForcePathStyle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Force Path Style (MinIO, LocalStack)"
                />
              </FormControl>
            </Grid>
          </>
        )}

        <Grid item xs={12}>
          <h2 className={classes.groupTitle}>Image Optimization</h2>
        </Grid>

        <Grid xs={12} sm={6} md={4} item>
          <FormControl className={classes.fieldContainer}>
            <FormControlLabel
              control={
                <Switch
                  checked={imageOptimizationEnabled}
                  onChange={e => setImageOptimizationEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label="Enable Image Optimization"
            />
          </FormControl>
        </Grid>

        {imageOptimizationEnabled && (
          <>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Max Width (pixels)"
                  type="number"
                  value={maxWidth}
                  onChange={e => setMaxWidth(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Quality (0-100)"
                  type="number"
                  value={quality}
                  onChange={e => setQuality(e.target.value)}
                  variant="standard"
                  inputProps={{ min: 0, max: 100 }}
                />
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.fieldContainer}>
                <TextField
                  label="Max Size (bytes)"
                  type="number"
                  value={maxBytes}
                  onChange={e => setMaxBytes(e.target.value)}
                  variant="standard"
                />
              </FormControl>
            </Grid>
          </>
        )}

        <Grid xs={12} item>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleTestConnection}
            disabled={testing || saving}
            className={`${classes.saveButton} ${classes.buttonSpacing}`}
          >
            {testing ? <CircularProgress size={24} /> : "Test Connection"}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || testing}
            className={classes.saveButton}
          >
            {saving ? <CircularProgress size={24} /> : "Save Configuration"}
          </Button>
        </Grid>
      </Grid>
    </>
  );
}
