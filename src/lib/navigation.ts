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
  ScrollText,
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
      { name: "Exception Management", href: "/compliance/exception", icon: AlertTriangle },
      { name: "KPI", href: "/compliance/kpi", icon: BarChart3 },
      { name: "Reports", href: "/compliance/reports", icon: FileText },
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
      { name: "Risk Dashboard", icon: PieChart },
      { name: "Risk Register", icon: ClipboardList },
      { name: "Risk Assessment", icon: Search },
      { name: "Risk Response Strategy", icon: CheckSquare },
      { name: "Risk Settings", icon: Settings2 },
      { name: "Reports", icon: FileText },
    ],
  },
  {
    name: "Internal Audit",
    icon: ClipboardCheck,
    children: [
      { name: "Audit Dashboard", href: "/audit/dashboard", icon: PieChart },
      { name: "Audit Calendar", href: "/audit/calendar", icon: Calendar },
      { name: "Audit Execution", href: "/audit/execution", icon: Play },
      { name: "Audit Findings", href: "/audit/findings", icon: Search },
      { name: "CAPA", href: "/audit/capa", icon: CheckSquare },
      { name: "Reports", href: "/audit/reports", icon: FileText },
    ],
  },
  {
    name: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
  },
  {
    name: "Log Out",
    href: "/login",
    icon: LogOut,
  },
];
