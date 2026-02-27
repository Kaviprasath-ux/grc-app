"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

// Design system aligned colors
const ROOT_COLOR = "var(--primary-600)"; // #8A6050 - deep terracotta for root node
const NODE_COLOR = "var(--primary-500)"; // #A57865 - terracotta for child nodes
const LINE_COLOR = "var(--primary-200)"; // #EDD0C2 - light terracotta for lines

interface Department {
  id: string;
  name: string;
}

interface UserNode {
  id: string;
  fullName: string;
  designation: string;
  role: string;
  department?: {
    id: string;
    name: string;
  };
  departmentId?: string;
  function?: string;
  reportingManagerId?: string;
  userRoles?: { role: { name: string } }[];
}

interface TreeNode extends UserNode {
  children: TreeNode[];
}

// Single org chart node with design system colors
function OrgChartNode({ node, isRoot = false, showDepartment = true, mirrored = false, tDeptName }: { node: TreeNode; isRoot?: boolean; showDepartment?: boolean; mirrored?: boolean; tDeptName?: (id: string | null | undefined) => string | undefined }) {
  const roleName = node.userRoles?.[0]?.role?.name || node.role;
  const headerColor = isRoot ? ROOT_COLOR : NODE_COLOR;
  const deptDisplayName = tDeptName?.(node.departmentId || node.department?.id) || node.department?.name;

  return (
    <div className="flex flex-col items-center" style={mirrored ? { transform: 'scaleX(-1)' } : undefined}>
      <div
        className={cn(
          "rounded-lg border overflow-hidden transition-shadow",
          isRoot
            ? "min-w-[200px] max-w-[220px] shadow-md ring-1 ring-primary-200"
            : "min-w-[160px] max-w-[200px] shadow-sm"
        )}
        style={{ borderColor: isRoot ? headerColor : "#E0E7FF" }}
      >
        {/* Header with role/designation */}
        <div
          className={cn(
            "px-3 text-white text-center",
            isRoot ? "py-2.5" : "py-2"
          )}
          style={{ backgroundColor: headerColor }}
        >
          <p className={cn(
            "font-medium truncate",
            isRoot ? "text-xs" : "text-xs"
          )}>
            {node.designation || roleName}
          </p>
        </div>
        {/* Body with name */}
        <div className={cn(
          "bg-white text-center",
          isRoot ? "px-4 py-3" : "px-3 py-2"
        )}>
          <p className={cn(
            "font-semibold text-slate-800 truncate",
            isRoot ? "text-sm" : "text-sm"
          )}>
            {node.fullName}
          </p>
          {showDepartment && deptDisplayName && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {deptDisplayName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Base node width and gap for calculating connector positions
const NODE_WIDTH = 200;
const NODE_GAP = 24;

// Calculate the total width needed for a subtree
function getSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) {
    return NODE_WIDTH;
  }
  const childrenWidth = node.children.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
  const gapsWidth = (node.children.length - 1) * NODE_GAP;
  return Math.max(NODE_WIDTH, childrenWidth + gapsWidth);
}

// Recursive tree rendering with proper connected lines
function OrgChartTree({ nodes, level = 0, showDepartment = true, mirrored = false, tDeptName }: { nodes: TreeNode[]; level?: number; showDepartment?: boolean; mirrored?: boolean; tDeptName?: (id: string | null | undefined) => string | undefined }) {
  if (nodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Current level nodes */}
      <div className="flex justify-center" style={{ gap: `${NODE_GAP}px` }}>
        {nodes.map((node) => {
          const childCount = node.children.length;

          // Calculate widths for each child subtree
          const childWidths = node.children.map(child => getSubtreeWidth(child));
          const totalChildrenWidth = childWidths.reduce((sum, w) => sum + w, 0) +
            (childCount > 1 ? (childCount - 1) * NODE_GAP : 0);

          // Calculate x positions for connector lines (center of each child subtree)
          const childXPositions: number[] = [];
          let currentX = 0;
          childWidths.forEach((width) => {
            childXPositions.push(currentX + width / 2);
            currentX += width + NODE_GAP;
          });

          return (
            <div key={node.id} className="flex flex-col items-center">
              <OrgChartNode node={node} isRoot={level === 0} showDepartment={showDepartment} mirrored={mirrored} tDeptName={tDeptName} />

              {/* Connector lines to children */}
              {childCount > 0 && (
                <div className="flex flex-col items-center">
                  {/* Vertical line from parent going down */}
                  <div
                    style={{
                      width: "2px",
                      height: "20px",
                      backgroundColor: LINE_COLOR,
                    }}
                  />

                  {/* SVG for horizontal line with curved corners */}
                  {childCount > 1 ? (
                    <svg
                      width={totalChildrenWidth}
                      height="30"
                      style={{ overflow: "visible" }}
                    >
                      {/* Main horizontal line */}
                      <line
                        x1={childXPositions[0]}
                        y1="0"
                        x2={childXPositions[childCount - 1]}
                        y2="0"
                        stroke={LINE_COLOR}
                        strokeWidth="2"
                      />

                      {/* Vertical drops for each child */}
                      {childXPositions.map((x, idx) => (
                        <line
                          key={idx}
                          x1={x}
                          y1="0"
                          x2={x}
                          y2="30"
                          stroke={LINE_COLOR}
                          strokeWidth="2"
                        />
                      ))}
                    </svg>
                  ) : (
                    // Single child - just a vertical line
                    <div
                      style={{
                        width: "2px",
                        height: "30px",
                        backgroundColor: LINE_COLOR,
                      }}
                    />
                  )}

                  {/* Children nodes */}
                  <div className="flex justify-center" style={{ gap: `${NODE_GAP}px` }}>
                    {node.children.map((child, idx) => (
                      <div
                        key={child.id}
                        className="flex flex-col items-center"
                        style={{ width: `${childWidths[idx]}px` }}
                      >
                        <OrgChartTree nodes={[child]} level={level + 1} showDepartment={showDepartment} mirrored={mirrored} tDeptName={tDeptName} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ViewMode = "role" | "department";

export function OrgChart() {
  const { t, isRTL } = useLanguage();
  const [users, setUsers] = useState<UserNode[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("role");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");

  // Translate users and departments
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });

  // Build a map of translated users keyed by id for fast lookup
  const translatedUserMap = useMemo(() => {
    const map = new Map<string, UserNode>();
    translatedUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [translatedUsers]);

  const tDeptName = useCallback((id: string | null | undefined) => {
    if (!id) return undefined;
    return translatedDepartments.find(d => d.id === id)?.name;
  }, [translatedDepartments]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments"),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData);
        // Auto-select first department if available
        if (deptData.length > 0) {
          setSelectedDepartmentId(deptData[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build tree structure from flat user list with CustomerAdmin at top
  const buildTree = useCallback((userList: UserNode[]): TreeNode[] => {
    const userMap = new Map<string, TreeNode>();

    // Create TreeNode for each user
    userList.forEach((user) => {
      userMap.set(user.id, { ...user, children: [] });
    });

    // Find CustomerAdmin users (they will be at the top)
    const customerAdmins: TreeNode[] = [];
    const processedIds = new Set<string>();

    // Build parent-child relationships based on reportingManagerId
    userList.forEach((user) => {
      const node = userMap.get(user.id)!;
      const roleName = user.userRoles?.[0]?.role?.name || user.role;

      if (user.reportingManagerId && userMap.has(user.reportingManagerId)) {
        // User has a reporting manager - add as child
        const parent = userMap.get(user.reportingManagerId)!;
        parent.children.push(node);
        processedIds.add(user.id);
      } else if (roleName === "CustomerAdministrator") {
        // CustomerAdmin without reporting manager goes to top
        customerAdmins.push(node);
        processedIds.add(user.id);
      }
    });

    // Users without reporting manager who are not CustomerAdmin
    const unassignedUsers: TreeNode[] = [];
    userList.forEach((user) => {
      if (!processedIds.has(user.id)) {
        const node = userMap.get(user.id)!;
        unassignedUsers.push(node);
      }
    });

    // Sort function by role priority then by name
    const sortChildren = (nodes: TreeNode[]) => {
      const rolePriority: Record<string, number> = {
        CustomerAdministrator: 1,
        AuditHead: 2,
        AuditManager: 3,
        Reviewer: 4,
        DepartmentReviewer: 5,
        Contributor: 6,
        DepartmentContributor: 7,
        Auditor: 8,
        Auditee: 9,
      };

      nodes.sort((a, b) => {
        const aRole = a.userRoles?.[0]?.role?.name || a.role;
        const bRole = b.userRoles?.[0]?.role?.name || b.role;
        const aPriority = rolePriority[aRole] || 100;
        const bPriority = rolePriority[bRole] || 100;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.fullName.localeCompare(b.fullName);
      });

      nodes.forEach((node) => {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    // Sort CustomerAdmins and their children
    sortChildren(customerAdmins);
    sortChildren(unassignedUsers);

    // If we have CustomerAdmins, place unassigned users under the first CustomerAdmin
    if (customerAdmins.length > 0) {
      if (unassignedUsers.length > 0) {
        // Add unassigned users as children of the first CustomerAdmin
        customerAdmins[0].children.push(...unassignedUsers);
        sortChildren(customerAdmins[0].children);
      }
      return customerAdmins;
    }

    // If no CustomerAdmins, just show all unassigned users at root level
    return unassignedUsers;
  }, []);

  // Build tree structure for department view - shows department as root with users as children
  const buildDepartmentTree = useCallback((userList: UserNode[], departmentId: string, deptName: string): TreeNode[] => {
    // Filter users belonging to the selected department
    const deptUsers = userList.filter(
      (user) => user.department?.id === departmentId || user.departmentId === departmentId
    );

    if (deptUsers.length === 0) return [];

    const userMap = new Map<string, TreeNode>();

    // Role priority for sorting
    const rolePriority: Record<string, number> = {
      CustomerAdministrator: 1,
      AuditHead: 2,
      AuditManager: 3,
      Reviewer: 4,
      DepartmentReviewer: 5,
      Contributor: 6,
      DepartmentContributor: 7,
      Auditor: 8,
      Auditee: 9,
    };

    const getRolePriority = (user: UserNode) => {
      const roleName = user.userRoles?.[0]?.role?.name || user.role;
      return rolePriority[roleName] || 100;
    };

    // Create TreeNode for each department user
    deptUsers.forEach((user) => {
      userMap.set(user.id, { ...user, children: [] });
    });

    // Track users with valid reporting managers in department
    const hasManagerInDept = new Set<string>();

    // Build parent-child relationships for users with managers in department
    deptUsers.forEach((user) => {
      if (user.reportingManagerId && userMap.has(user.reportingManagerId)) {
        const node = userMap.get(user.id)!;
        const parent = userMap.get(user.reportingManagerId)!;
        parent.children.push(node);
        hasManagerInDept.add(user.id);
      }
    });

    // Find all root candidates (users without manager in department)
    const rootCandidates: TreeNode[] = [];
    deptUsers.forEach((user) => {
      if (!hasManagerInDept.has(user.id)) {
        rootCandidates.push(userMap.get(user.id)!);
      }
    });

    // Sort root candidates by role priority
    rootCandidates.sort((a, b) => {
      const aPriority = getRolePriority(a);
      const bPriority = getRolePriority(b);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.fullName.localeCompare(b.fullName);
    });

    // Find the highest priority (lowest number) among root candidates
    const highestPriority = rootCandidates.length > 0 ? getRolePriority(rootCandidates[0]) : 100;

    // Separate into top-level roots (highest priority) and users to be assigned
    const topRoots: TreeNode[] = [];
    const unassignedUsers: TreeNode[] = [];

    rootCandidates.forEach((node) => {
      if (getRolePriority(node) === highestPriority) {
        topRoots.push(node);
      } else {
        unassignedUsers.push(node);
      }
    });

    // Assign unassigned users to the first top root (highest ranking person)
    if (topRoots.length > 0 && unassignedUsers.length > 0) {
      topRoots[0].children.push(...unassignedUsers);
    }

    // Sort function for children
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        const aPriority = getRolePriority(a);
        const bPriority = getRolePriority(b);
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.fullName.localeCompare(b.fullName);
      });

      nodes.forEach((node) => {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };

    sortChildren(topRoots);

    // Create department node as the root with top-level users as children
    const departmentNode: TreeNode = {
      id: `dept-${departmentId}`,
      fullName: deptName,
      designation: t("Department"),
      role: "",
      children: topRoots,
    };

    return [departmentNode];
  }, [t]);

  const roleTree = buildTree(translatedUsers);
  const selectedDepartment = translatedDepartments.find(d => d.id === selectedDepartmentId);
  const departmentTree = viewMode === "department" && selectedDepartmentId && selectedDepartment
    ? buildDepartmentTree(translatedUsers, selectedDepartmentId, selectedDepartment.name)
    : [];
  const tree = viewMode === "role" ? roleTree : departmentTree;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 px-5 py-5">
        <p className="text-sm text-slate-400">{t("Loading organization chart...")}</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 px-5 py-5">
        <p className="text-sm text-slate-400">
          {t("No users found. Add users and assign reporting managers to build the organization chart.")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full" style={isRTL ? { direction: 'rtl' } : undefined}>
      {/* View Mode Controls - section header style */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("View Mode")}</span>
          <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
            <SelectTrigger className="w-[180px] h-8 text-sm bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role">{t("Role-wise Chart")}</SelectItem>
              <SelectItem value="department">{t("Department-wise Chart")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewMode === "department" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</span>
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger className="w-[180px] h-8 text-sm bg-slate-50">
                <SelectValue placeholder={t("Select department")} />
              </SelectTrigger>
              <SelectContent>
                {translatedDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Chart Content */}
      {tree.length === 0 ? (
        <div className="flex items-center justify-center h-48 mx-5 my-5 border border-dashed border-slate-200 rounded-lg">
          <p className="text-sm text-slate-400">
            {viewMode === "department" && selectedDepartmentId
              ? `${t("No users found in")} ${selectedDepartment?.name || t("selected department")}. ${t("Assign users to this department to see the hierarchy.")}`
              : viewMode === "department"
              ? t("Select a department to view its hierarchy.")
              : t("No organization hierarchy defined. Assign reporting managers to users to build the chart.")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto" style={isRTL ? { direction: 'rtl' } : undefined}>
          <div className="min-w-max px-6 py-6" style={isRTL ? { transform: 'scaleX(-1)' } : undefined}>
            <OrgChartTree nodes={tree} showDepartment={viewMode === "role"} mirrored={isRTL} tDeptName={tDeptName} />
          </div>
        </div>
      )}
    </div>
  );
}
