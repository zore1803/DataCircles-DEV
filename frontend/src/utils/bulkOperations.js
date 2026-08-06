import API from '../services/api';

export const bulkDelete = async (entityPath, selectedIds) => {
  return await Promise.all(
    selectedIds.map((id) => API.delete(`/${entityPath}/${id}`))
  );
};
