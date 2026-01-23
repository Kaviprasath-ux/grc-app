"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// Unified subtle color for all elements
const THEME_COLOR = "#64748b"; // slate-500 - subtle and professional
const LINE_COLOR = "#cbd5e1"; // slate-300 - light for lines

interface UserNode {
  id: string;
  fullName: string;
  designation: string;
  role: string;
  department?: {
    name: string;
  };
  function?: string;
  reportingManagerId?: string;
  userRoles?: { role: { name: string } }[];
}

interface TreeNode extends UserNode {
  children: TreeNode[];
}

// Single org chart node with unified color
function OrgChartNode({ node, isRoot = false }: { node: TreeNode; isRoot?: boolean }) {
  const roleName = node.userRoles?.[0]?.role?.name || node.role;

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "rounded-lg shadow-sm border min-w-[160px] max-w-[200px] overflow-hidden",
          isRoot && "min-w-[200px]"
        )}
        style={{ borderColor: LINE_COLOR }}
      >
        {/* Header with role/designation */}
        <div
          className="px-3 py-2 text-white text-center"
          style={{ backgroundColor: THEME_COLOR }}
        >
          <p className="text-xs font-medium truncate">
            {node.designation || roleName}
          </p>
        </div>
        {/* Body with name */}
        <div className="bg-white px-3 py-2 text-center">
          <p className="text-sm font-semibold text-gray-700 truncate">
            {node.fullName}
          </p>
          {node.department?.name && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {node.department.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Recursive tree rendering with smooth curved connectors
function OrgChartTree({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) {
  if (nodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Current level nodes */}
      <div className="flex justify-center gap-8">
        {nodes.map((node) => (
          <div key={node.id} className="flex flex-col items-center">
            <OrgChartNode node={node} isRoot={level === 0} />

            {/* Connector line to children */}
            {node.children.length > 0 && (
              <div className="flex flex-col items-center">
                {/* Vertical line from parent */}
                <div
                  className="w-0.5 h-5"
                  style={{ backgroundColor: LINE_COLOR }}
                />

                {/* Children container */}
                <div className="relative">
                  {/* Horizontal line spanning all children */}
                  {node.children.length > 1 && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5"
                      style={{
                        backgroundColor: LINE_COLOR,
                        width: `calc(100% - 80px)`,
                      }}
                    />
                  )}

                  {/* Children */}
                  <div className="flex justify-center">
                    {node.children.map((child, childIndex) => {
                      const isOnly = node.children.length === 1;
                      const isFirst = childIndex === 0;
                      const isLast = childIndex === node.children.length - 1;
                      const isMiddle = !isFirst && !isLast;

                      return (
                        <div key={child.id} className="flex flex-col items-center" style={{ minWidth: "180px" }}>
                          {/* Vertical connector with curved corners */}
                          {!isOnly && (
                            <svg width="40" height="20" className="overflow-visible">
                              {isFirst && (
                                <path
                                  d="M 20 0 L 20 8 Q 20 12 24 12 L 40 12"
                                  fill="none"
                                  stroke={LINE_COLOR}
                                  strokeWidth="2"
                                />
                              )}
                              {isLast && (
                                <path
                                  d="M 20 0 L 20 8 Q 20 12 16 12 L 0 12"
                                  fill="none"
                                  stroke={LINE_COLOR}
                                  strokeWidth="2"
                                />
                              )}
                              {isMiddle && (
                                <line
                                  x1="20" y1="0" x2="20" y2="12"
                                  stroke={LINE_COLOR}
                                  strokeWidth="2"
                                />
                              )}
                              {/* Vertical line down */}
                              <line
                                x1="20" y1="12" x2="20" y2="20"
                                stroke={LINE_COLOR}
                                strokeWidth="2"
                              />
                            </svg>
                          )}
                          <OrgChartTree nodes={[child]} level={level + 1} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgChart() {
  const [users, setUsers] = useState<UserNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
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

    // If we have CustomerAdmins with children, show them first
    // Otherwise, show all users at root level
    if (customerAdmins.length > 0 && customerAdmins.some(ca => ca.children.length > 0)) {
      return customerAdmins;
    }

    // If no hierarchy defined, just show CustomerAdmins at top, then others
    return [...customerAdmins, ...unassignedUsers];
  }, []);

  const tree = buildTree(users);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading organization chart...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          No users found. Add users and assign reporting managers to build the organization chart.
        </p>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">
          No organization hierarchy defined. Assign reporting managers to users to build the chart.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max p-8">
        <OrgChartTree nodes={tree} />
      </div>

      {/* Info text */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Organization hierarchy based on reporting manager assignments
      </div>
    </div>
  );
}
