/** 报告列表状态 */
import { create } from 'zustand';
import type { ReportMeta } from '@/lib/types';
import { listReports } from '@/api/client';

interface ReportStore {
  reports: ReportMeta[];
  loading: boolean;
  fetchReports: () => Promise<void>;
  removeReport: (id: string) => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  reports: [],
  loading: false,
  fetchReports: async () => {
    set({ loading: true });
    try {
      const reports = await listReports();
      set({ reports, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  removeReport: (id) =>
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== id),
    })),
}));
