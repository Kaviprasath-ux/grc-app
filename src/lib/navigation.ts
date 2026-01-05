import {
  LayoutDashboard,
  Building2,
  User,
  Users,
  Briefcase,
  Settings,
  FileText,
  Shield,
  GitBranch,
  Link,
  FileCheck,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Package,
  Layers,
  Settings2,
  PieChart,
  ClipboardCheck,
  Calendar,
  Play,
  Search,
  CheckSquare,
  LogOut,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
}

export const navigation: NavItem[] = [
  {
    name: "Organization",
    icon: Building2,
    children: [
      { name: "Organization Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Profile", href: "/organization/profile", icon: User },
      { name: "Context", href: "/organization/context", icon: Briefcase },
      { name: "Users", href: "/organization/users", icon: Users },
      { name: "Process", href: "/organization/process", icon: GitBranch },
      { name: "Organization Settings", href: "/organization/settings", icon: Settings },
      { name: "Reports", href: "/organization/reports", icon: FileText },
    ],
  },
  {
    name: "Compliance",
    icon: Shield,
    children: [
      { name: "Framework", href: "/compliance/framework", icon: Layers },
      { name: "Control", href: "/compliance/control", icon: Link },
      { name: "Governance", href: "/compliance/governance", icon: FileCheck },
      { name: "Evidence", href: "/compliance/evidence", icon: ClipboardList },
      { name: "Exception Management", href: "/compliance/exceptions", icon: AlertTriangle },
      { name: "KPI", href: "/compliance/kpis", icon: BarChart3 },
      { name: "Risk Compliance Matrix", href: "/compliance/risk-matrix", icon: AlertTriangle },
      { name: "Reports", href: "/compliance/reports", icon: FileText },
      { name: "Master Data", href: "/compliance/master-data", icon: Settings2 },
    ],
  },
  {
    name: "Asset Management",
    icon: Package,
    children: [
      { name: "Asset Inventory", href: "/assets/inventory", icon: Package },
      { name: "Asset Classification", href: "/assets/classification", icon: Layers },
      { name: "Asset Settings", href: "/assets/settings", icon: Settings2 },
      { name: "Reports", href: "/assets/reports", icon: FileText },
    ],
  },
  {
    name: "Risk Management",
    icon: AlertTriangle,
    children: [
      { name: "Risk Dashboard", href: "/risks/dashboard", icon: PieChart },
      { name: "Risk Register", href: "/risks/register", icon: ClipboardList },
      { name: "Risk Assessment", href: "/risks/assessment", icon: Search },
      { name: "Risk Response Strategy", href: "/risks/response", icon: CheckSquare },
      { name: "Risk Settings", href: "/risks/settings", icon: Settings2 },
      { name: "Reports", href: "/risks/reports", icon: FileText },
    ],
  },
  {
    name: "Internal Audit",
    icon: ClipboardCheck,
    children: [
      { name: "RiskRegister", href: "/internal-audit/risk-register", icon: ClipboardList },
      { name: "Settings", href: "/internal-audit/settings", icon: Settings2 },
    ],
  },
  {
    name: "Log Out",
    href: "/login",
    icon: LogOut,
  },
];
