"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/shared";
import {
  Home,
  ChevronRight,
  Users,
  UserCog,
  FileText,
  Layers,
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface GRCDashboardData {
  stats: {
    customerAccounts: number;
    customers: number;
    emailTemplates: number;
    frameworks: number;
  };
  recentCustomers: {
    id: string;
    customerCode: string;
    customerName: string;
    email: string;
    customerAccountId: string | null;
    compliancePercentage: number;
  }[];
}

export default function GRCAdminLandingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [data, setData] = useState<GRCDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/grc/dashboard/stats");
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching GRC dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading dashboard...")}</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { customerAccounts: 0, customers: 0, emailTemplates: 0, frameworks: 0 };
  const recentCustomers = data?.recentCustomers || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Home")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("GRC Administration")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("GRC Administration")}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          label={t("Customer Accounts")}
          value={stats.customerAccounts}
          href="/grc/customer-accounts"
          icon={UserCog}
        />
        <StatsCard
          label={t("Customers")}
          value={stats.customers}
          href="/grc/customers"
          icon={Users}
        />
        <StatsCard
          label={t("Email Templates")}
          value={stats.emailTemplates}
          href="/grc/email-templates"
          icon={FileText}
        />
        <StatsCard
          label={t("Total Frameworks")}
          value={stats.frameworks}
          icon={Layers}
        />
      </div>

      {/* Recent Customers Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-slate-800">{t("Recent Customers")}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-600 hover:text-primary-700"
            onClick={() => router.push("/grc/customers")}
          >
            {t("View All")}
            <ArrowRight className="h-3.5 w-3.5 ltr:ml-1 rtl:mr-1" />
          </Button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase">{t("Customer Code")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase">{t("Customer Name")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase">{t("Email")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase">{t("Compliance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-0">
                      <div className="py-16 text-center">
                        <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                          <Users className="h-6 w-6 text-primary-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 mb-1">{t("No customers found")}</p>
                        <p className="text-xs text-slate-400">{t("Create a customer account to get started")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentCustomers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50/50">
                      <TableCell className="py-3 text-sm font-medium text-slate-700">{customer.customerCode}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-600">{customer.customerName}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-500">{customer.email}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${customer.compliancePercentage}%`,
                                backgroundColor: customer.compliancePercentage >= 75 ? '#10B981' : customer.compliancePercentage >= 50 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{customer.compliancePercentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* System Configuration Link */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-primary-50 to-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-primary-100 text-primary-600 shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{t("System Configuration")}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t("Configure email settings, templates, and system preferences")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => router.push("/grc/email-settings")}
          >
            <Settings className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Email Settings")}
          </Button>
        </div>
      </div>
    </div>
  );
}
