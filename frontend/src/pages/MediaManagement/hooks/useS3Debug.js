import { useState } from "react";
import toastError from "../../../errors/toastError";
import api from "../../../services/api";

export const useS3Debug = () => {
  const [s3DebugOpen, setS3DebugOpen] = useState(false);
  const [s3DebugData, setS3DebugData] = useState(null);
  const [s3DebugLoading, setS3DebugLoading] = useState(false);

  const handleS3Debug = async () => {
    setS3DebugLoading(true);
    try {
      const { data } = await api.get("/media/s3-debug");
      setS3DebugData(data);
      setS3DebugOpen(true);
    } catch (err) {
      toastError(err);
    } finally {
      setS3DebugLoading(false);
    }
  };

  const closeS3Debug = () => {
    setS3DebugOpen(false);
  };

  return {
    s3DebugOpen,
    s3DebugData,
    s3DebugLoading,
    handleS3Debug,
    closeS3Debug,
  };
};
