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

// Child node width for calculating connector positions
const CHILD_WIDTH = 200;
const CHILD_GAP = 24;

// Recursive tree rendering with proper connected lines
function OrgChartTree({ nodes, level = 0 }: { nodes: TreeNode[]; level?: number }) {
  if (nodes.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {/* Current level nodes */}
      <div className="flex justify-center" style={{ gap: `${CHILD_GAP}px` }}>
        {nodes.map((node) => {
          const childCount = node.children.length;
          const totalChildrenWidth = childCount > 0
            ? (childCount * CHILD_WIDTH) + ((childCount - 1) * CHILD_GAP)
            : 0;

          return (
            <div key={node.id} className="flex flex-col items-center">
              <OrgChartNode node={node} isRoot={level === 0} />

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
                        x1={CHILD_WIDTH / 2}
                        y1="0"
                        x2={totalChildrenWidth - CHILD_WIDTH / 2}
                        y2="0"
                        stroke={LINE_COLOR}
                        strokeWidth="2"
                      />

                      {/* Curved corners and vertical drops for each child */}
                      {node.children.map((_, idx) => {
                        const x = (CHILD_WIDTH / 2) + (idx * (CHILD_WIDTH + CHILD_GAP));
                        const isFirst = idx === 0;
                        const isLast = idx === childCount - 1;
                        const radius = 8;

                        if (isFirst) {
                          // Left corner - curved
                          return (
                            <path
                              key={idx}
                              d={`M ${x} 0
                                  Q ${x} ${radius} ${x} ${radius}
                                  L ${x} 30`}
                              fill="none"
                              stroke={LINE_COLOR}
                              strokeWidth="2"
                            />
                          );
                        } else if (isLast) {
                          // Right corner - curved
                          return (
                            <path
                              key={idx}
                              d={`M ${x} 0
                                  Q ${x} ${radius} ${x} ${radius}
                                  L ${x} 30`}
                              fill="none"
                              stroke={LINE_COLOR}
                              strokeWidth="2"
                            />
                          );
                        } else {
                          // Middle - straight down
                          return (
                            <line
                              key={idx}
                              x1={x}
                              y1="0"
                              x2={x}
                              y2="30"
                              stroke={LINE_COLOR}
                              strokeWidth="2"
                            />
                          );
                        }
                      })}
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
                  <div className="flex justify-center" style={{ gap: `${CHILD_GAP}px` }}>
                    {node.children.map((child) => (
                      <div
                        key={child.id}
                        className="flex flex-col items-center"
                        style={{ width: `${CHILD_WIDTH}px` }}
                      >
                        <OrgChartTree nodes={[child]} level={level + 1} />
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
