"use client";

/**
 * AllUsersTab — shared "All Users" view used by /organization/users and
 * /tprm/user-management.
 *
 * Shows every user belonging to the customer (irrespective of module) with
 * basic details and a "Modules" badge column. Each row has an "Assign Role"
 * action that opens AssignRoleDialog scoped to the current module.
 *
 * The button is disabled when the user is already in `moduleCode`.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignRoleDialog } from "./AssignRoleDialog";
import type { ModuleCode } from "@/lib/role-module-map";

interface AllUsersTabUser {
  id: string;
  userId?: string | null;
  userName?: string | null;
  fullName?: string | null;
  email?: string | null;
  designation?: string | null;
  department?: { name?: string | null } | null;
  roleModules?: ModuleCode[];
  isActive?: boolean | null;
}

interface AllUsersTabProps {
  /** Which module is the parent page hosting? Drives Assign-Role behaviour. */
  currentModule: ModuleCode;
}

function moduleLabel(code: ModuleCode): string {
  return code === "INTERNAL_AUDIT" ? "Internal Audit" : code;
}

export function AllUsersTab({ currentModule }: AllUsersTabProps) {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AllUsersTabUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignTarget, setAssignTarget] = useState<AllUsersTabUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users?includeModules=true");
      if (res.ok) {
        const data: AllUsersTabUser[] = await res.json();
        setUsers(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.userName, u.fullName, u.email, u.designation]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [users, search]);

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <Input
          placeholder={t("Search by name, username, email…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-white"
        />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Name")}</TableHead>
              <TableHead>{t("Username")}</TableHead>
              <TableHead>{t("Email")}</TableHead>
              <TableHead>{t("Department")}</TableHead>
              <TableHead>{t("Modules")}</TableHead>
              <TableHead className="text-right">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-500 text-sm">
                  {t("No users found")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const modules = u.roleModules ?? [];
                const alreadyInModule = modules.includes(currentModule);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.fullName || "—"}</TableCell>
                    <TableCell>{u.userName || "—"}</TableCell>
                    <TableCell className="text-slate-600">{u.email || "—"}</TableCell>
                    <TableCell>{u.department?.name || "—"}</TableCell>
                    <TableCell>
                      {modules.length === 0 ? (
                        <span className="text-xs text-slate-400">{t("None")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {modules.map((m) => (
                            <Badge
                              key={m}
                              variant={m === currentModule ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {moduleLabel(m)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={alreadyInModule}
                        onClick={() => setAssignTarget(u)}
                        title={
                          alreadyInModule
                            ? t(`Already in ${moduleLabel(currentModule)}`)
                            : t(`Assign role in ${moduleLabel(currentModule)}`)
                        }
                      >
                        <Plus className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                        {alreadyInModule
                          ? t("In this module")
                          : t("Assign role")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {assignTarget && (
        <AssignRoleDialog
          open={true}
          user={assignTarget}
          moduleCode={currentModule}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => {
            setAssignTarget(null);
            void fetchUsers();
          }}
        />
      )}
    </>
  );
}
