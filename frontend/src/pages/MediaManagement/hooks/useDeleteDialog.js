import { useState } from "react";

export const useDeleteDialog = () => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const openDeleteDialog = file => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  return {
    deleteDialogOpen,
    fileToDelete,
    openDeleteDialog,
    closeDeleteDialog,
  };
};
