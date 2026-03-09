"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

interface Comment {
  id: string;
  userId: string;
  userRole: string | null;
  message: string;
  createdAt: string;
  user: { fullName: string };
}

const ROLE_COLORS: Record<string, string> = {
  "Account Manager": "bg-blue-100 text-blue-700",
  "Assessor": "bg-purple-100 text-purple-700",
  "Approver": "bg-teal-100 text-teal-700",
  "Admin": "bg-gray-100 text-gray-700",
  "User": "bg-gray-100 text-gray-600",
};

interface RemediationCommentsProps {
  remediationId: string;
  readOnly?: boolean;
}

export function RemediationComments({ remediationId, readOnly = false }: RemediationCommentsProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // User can only comment if the last comment is NOT from them (one comment per turn)
  const lastCommentIsFromMe = useMemo(() => {
    if (!currentUserId || comments.length === 0) return false;
    return comments[comments.length - 1].userId === currentUserId;
  }, [comments, currentUserId]);

  useEffect(() => {
    if (!remediationId) return;
    setLoading(true);
    fetch(`/api/tprm/remediation-comments?remediationId=${remediationId}`)
      .then(res => res.json())
      .then(json => setComments(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [remediationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/tprm/remediation-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remediationId, message: newMessage }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments(prev => [...prev, comment]);
        setNewMessage("");
      }
    } catch {
      // silently handle
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="border rounded-lg">
      <div className="px-3 py-2 border-b bg-muted/30">
        <h5 className="text-sm font-semibold">{t("Remediation Comments")}</h5>
      </div>

      {/* Comments thread */}
      <div ref={scrollRef} className="max-h-[250px] overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t("No comments yet")}</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {c.user?.fullName?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.user?.fullName || "Unknown"}</span>
                  {c.userRole && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.userRole] || ROLE_COLORS["User"]}`}>
                      {c.userRole}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">{c.message}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      {!readOnly && !lastCommentIsFromMe && (
        <div className="border-t p-2 flex gap-2">
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={t("Add a comment...")}
            rows={1}
            className="text-sm min-h-[36px] resize-none"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="sm"
            className="flex-shrink-0 h-9 w-9 p-0"
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
