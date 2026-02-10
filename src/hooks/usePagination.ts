import { useEffect, useMemo, useState } from "react";

interface UsePaginationProps<T> {
  data?: readonly T[];
  itemsPerPage?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  paginatedData: T[];
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  resetPage: () => void;
}

export function usePagination<T>({
  data,
  itemsPerPage = 10,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const safeData = useMemo(() => data ?? [], [data]);

  const totalPages = useMemo(() => {
    if (itemsPerPage <= 0) return 1;
    return Math.max(1, Math.ceil(safeData.length / itemsPerPage));
  }, [safeData.length, itemsPerPage]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return safeData.slice(startIndex, startIndex + itemsPerPage);
  }, [safeData, currentPage, itemsPerPage]);

  // ✅ Correct place to sync state with data changes
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const resetPage = () => {
    setCurrentPage(1);
  };

  return {
    currentPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    goToNextPage,
    goToPreviousPage,
    resetPage,
  };
}
