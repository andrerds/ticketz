import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import toastError from "../../../errors/toastError";
import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";

export const useMediaManagement = () => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
    loading: false,
  });

  const loadMediaFiles = useCallback(
    async (filters = {}, append = false) => {
      if (pagination.loading) return;

      setPagination(prev => ({ ...prev, loading: true }));

      try {
        const params = {};
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        if (filters.fileType) params.fileType = filters.fileType;
        if (filters.storageLocation)
          params.storageLocation = filters.storageLocation;

        params.limit = pagination.limit;
        params.offset = append ? pagination.offset + pagination.limit : 0;

        const { data } = await api.get("/media", { params });

        const responseData = data.data || data;

        setMediaFiles(prev => {
          if (append) {
            // Filter out duplicates when appending
            const existingIds = new Set(prev.map(file => file.messageId));
            const newFiles = responseData.filter(
              file => !existingIds.has(file.messageId)
            );
            return [...prev, ...newFiles];
          }
          return responseData;
        });

        setPagination(prev => ({
          ...prev,
          total: data.total || responseData.length,
          offset: params.offset,
          hasMore: data.hasMore || false,
          loading: false,
        }));
      } catch (err) {
        toastError(err);
        setPagination(prev => ({ ...prev, loading: false }));
      }
    },
    [pagination.limit, pagination.offset, pagination.loading]
  );

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/media/stats");
      setStats(data);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const deleteFile = useCallback(
    async messageId => {
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
    async messageIds => {
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

  const handleSelectFile = useCallback(fileId => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const deletableFiles = mediaFiles.filter(f => f.canDelete);
    if (selectedFiles.length === deletableFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(deletableFiles.map(f => f.messageId));
    }
  }, [mediaFiles, selectedFiles.length]);

  const loadMore = useCallback(() => {
    if (pagination.hasMore && !pagination.loading) {
      loadMediaFiles({}, true);
    }
  }, [pagination.hasMore, pagination.loading, loadMediaFiles]);

  return {
    mediaFiles,
    stats,
    selectedFiles,
    pagination,
    loadMediaFiles,
    loadStats,
    loadMore,
    deleteFile,
    bulkDeleteFiles,
    handleSelectFile,
    handleSelectAll,
  };
};
