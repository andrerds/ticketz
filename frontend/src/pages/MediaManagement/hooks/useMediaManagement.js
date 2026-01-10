import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import toastError from "../../../errors/toastError";
import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";

export const useMediaManagement = () => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const loadMediaFiles = useCallback(async (filters = {}) => {
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
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/media/stats");
      setStats(data);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const deleteFile = useCallback(
    async (messageId) => {
      try {
        await api.delete(`/media/${messageId}`);
        toast.success(i18n.t("mediaManagement.messages.deleteSuccess"));
        await Promise.all([loadMediaFiles(), loadStats()]);
      } catch (err) {
        toastError(err);
      }
    },
    [loadMediaFiles, loadStats]
  );

  const bulkDeleteFiles = useCallback(
    async (messageIds) => {
      try {
        await api.post("/media/bulk-delete", { messageIds });
        toast.success(i18n.t("mediaManagement.messages.bulkDeleteSuccess"));
        setSelectedFiles([]);
        await Promise.all([loadMediaFiles(), loadStats()]);
      } catch (err) {
        toastError(err);
      }
    },
    [loadMediaFiles, loadStats]
  );

  const handleSelectFile = useCallback((fileId) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const deletableFiles = mediaFiles.filter((f) => f.canDelete);
    if (selectedFiles.length === deletableFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(deletableFiles.map((f) => f.messageId));
    }
  }, [mediaFiles, selectedFiles.length]);

  return {
    mediaFiles,
    stats,
    selectedFiles,
    loadMediaFiles,
    loadStats,
    deleteFile,
    bulkDeleteFiles,
    handleSelectFile,
    handleSelectAll,
  };
};
