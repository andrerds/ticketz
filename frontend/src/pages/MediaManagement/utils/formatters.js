const BYTE_UNITS = ["Bytes", "KB", "MB", "GB"];
const BYTES_PER_UNIT = 1024;

export const formatBytes = bytes => {
  if (bytes === 0) return "0 Bytes";

  const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT));
  const value = bytes / Math.pow(BYTES_PER_UNIT, unitIndex);

  return `${Math.round(value * 100) / 100} ${BYTE_UNITS[unitIndex]}`;
};

export const isDevEnvironment = () => {
  return process.env.NODE_ENV === "development";
};
