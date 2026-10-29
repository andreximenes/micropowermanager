import { useQueryClient } from '@tanstack/react-query';

/** Saving or deleting any location changes the tree, the map and the village pickers. */
export function useRefreshLocations() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clusters'] }),
      queryClient.invalidateQueries({ queryKey: ['mini-grids'] }),
      queryClient.invalidateQueries({ queryKey: ['villages'] }),
      queryClient.invalidateQueries({ queryKey: ['cities'] }),
    ]);
}
