import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock, Brain } from "lucide-react";

interface AIStatusBadgeProps {
  status: string;
  size?: "sm" | "default";
}

export function AIStatusBadge({ status, size = "default" }: AIStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "QUEUED":
        return {
          label: "AI Queued",
          icon: Clock,
          className: "bg-blue-100 text-blue-700 border-blue-300",
        };
      case "PROCESSING":
        return {
          label: "AI Processing",
          icon: Loader2,
          className: "bg-purple-100 text-purple-700 border-purple-300 animate-pulse",
        };
      case "INGESTED":
      case "READY":
        return {
          label: "AI Ready",
          icon: CheckCircle,
          className: "bg-green-100 text-green-700 border-green-300",
        };
      case "COMPLETED":
        return {
          label: "AI Reviewed",
          icon: Brain,
          className: "bg-emerald-100 text-emerald-700 border-emerald-300",
        };
      case "FAILED":
        return {
          label: "AI Failed",
          icon: XCircle,
          className: "bg-red-100 text-red-700 border-red-300",
        };
      case "IN_PROGRESS":
        return {
          label: "AI Reviewing",
          icon: Loader2,
          className: "bg-indigo-100 text-indigo-700 border-indigo-300 animate-pulse",
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig(status);

  if (!config) return null;

  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <Badge variant="outline" className={`${config.className} ${size === "sm" ? "text-xs" : ""}`}>
      <Icon className={`${iconSize} mr-1 ${config.icon === Loader2 ? "animate-spin" : ""}`} />
      {config.label}
    </Badge>
  );
}
