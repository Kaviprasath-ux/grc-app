"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

function OrgNode({
  node,
  level = 0,
  isExpanded,
  onToggle,
}: {
  node: TreeNode;
  level?: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = node.children.length > 0;
  const roleName = node.userRoles?.[0]?.role?.name || node.role;

  // Color coding based on role
  const getRoleColor = (role: string) => {
    switch (role) {
      case "CustomerAdministrator":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "AuditHead":
        return "bg-red-100 text-red-800 border-red-300";
      case "AuditManager":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "Reviewer":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "DepartmentReviewer":
        return "bg-cyan-100 text-cyan-800 border-cyan-300";
      case "Contributor":
        return "bg-green-100 text-green-800 border-green-300";
      case "DepartmentContributor":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "Auditor":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Auditee":
        return "bg-pink-100 text-pink-800 border-pink-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="relative">
      {/* Connector lines */}
      {level > 0 && (
        <div
          className="absolute left-0 top-0 border-l-2 border-muted-foreground/30"
          style={{
            height: "28px",
            marginLeft: "-20px",
          }}
        />
      )}
      {level > 0 && (
        <div
          className="absolute top-7 border-t-2 border-muted-foreground/30"
          style={{
            width: "20px",
            marginLeft: "-20px",
          }}
        />
      )}

      <div className="flex items-start gap-2">
        {/* Expand/Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={onToggle}
            className="mt-3 p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        {/* User card */}
        <Card
          className={cn(
            "mb-2 transition-all hover:shadow-md cursor-pointer min-w-[250px]",
            hasChildren && "border-l-4 border-l-primary"
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {hasChildren ? (
                  <Users className="h-5 w-5 text-primary" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{node.fullName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {node.designation || "No designation"}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={cn("text-xs", getRoleColor(roleName))}
                  >
                    {roleName}
                  </Badge>
                  {node.department?.name && (
                    <Badge variant="secondary" className="text-xs">
                      {node.department.name}
                    </Badge>
                  )}
                </div>
                {hasChildren && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {node.children.length} direct report{node.children.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TreeView({
  nodes,
  level = 0,
  expandedNodes,
  toggleNode,
}: {
  nodes: TreeNode[];
  level?: number;
  expandedNodes: Set<string>;
  toggleNode: (id: string) => void;
}) {
  return (
    <div className={cn("relative", level > 0 && "ml-8 pl-4")}>
      {nodes.map((node) => (
        <div key={node.id}>
          <OrgNode
            node={node}
            level={level}
            isExpanded={expandedNodes.has(node.id)}
            onToggle={() => toggleNode(node.id)}
          />
          {expandedNodes.has(node.id) && node.children.length > 0 && (
            <TreeView
              nodes={node.children}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OrgChartPage() {
  const [users, setUsers] = useState<UserNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        // Expand root nodes by default
        const roots = findRootNodes(data);
        setExpandedNodes(new Set(roots.map((n) => n.id)));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Find users without reporting managers (root nodes)
  const findRootNodes = (userList: UserNode[]): UserNode[] => {
    return userList.filter((u) => !u.reportingManagerId);
  };

  // Build tree structure from flat user list
  const buildTree = (userList: UserNode[]): TreeNode[] => {
    const userMap = new Map<string, TreeNode>();

    // Create TreeNode for each user
    userList.forEach((user) => {
      userMap.set(user.id, { ...user, children: [] });
    });

    const roots: TreeNode[] = [];

    // Build parent-child relationships
    userList.forEach((user) => {
      const node = userMap.get(user.id)!;
      if (user.reportingManagerId && userMap.has(user.reportingManagerId)) {
        const parent = userMap.get(user.reportingManagerId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by role priority then by name
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

    sortChildren(roots);
    return roots;
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedNodes(new Set(users.map((u) => u.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const tree = buildTree(users);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading organization chart...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Chart"
        actions={[
          {
            label: "Expand All",
            onClick: expandAll,
            variant: "outline",
          },
          {
            label: "Collapse All",
            onClick: collapseAll,
            variant: "outline",
          },
        ]}
      />

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No users found. Add users and assign reporting managers to build the organization chart.
          </CardContent>
        </Card>
      ) : tree.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No organization hierarchy defined. Assign reporting managers to users to build the chart.
          </CardContent>
        </Card>
      ) : (
        <div className="bg-background p-6 rounded-lg border overflow-x-auto">
          <TreeView
            nodes={tree}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
          />
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <h3 className="font-semibold mb-3 text-sm">Role Legend</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
              CustomerAdministrator
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
              AuditHead
            </Badge>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
              AuditManager
            </Badge>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              Reviewer
            </Badge>
            <Badge variant="outline" className="bg-cyan-100 text-cyan-800 border-cyan-300">
              DepartmentReviewer
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              Contributor
            </Badge>
            <Badge variant="outline" className="bg-teal-100 text-teal-800 border-teal-300">
              DepartmentContributor
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
              Auditor
            </Badge>
            <Badge variant="outline" className="bg-pink-100 text-pink-800 border-pink-300">
              Auditee
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
