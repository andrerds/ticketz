import {
  DeleteMediaFileService,
  DeleteMediaRequest,
  DeleteMediaResult
} from "./DeleteMediaFileService";

export const BulkDeleteMediaFilesService = async (
  requests: DeleteMediaRequest[]
): Promise<DeleteMediaResult[]> => {
  const results = await Promise.all(
    requests.map(request => DeleteMediaFileService(request))
  );

  return results;
};
