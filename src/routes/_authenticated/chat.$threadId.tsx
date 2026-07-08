import { ChatWindow } from "@/components/ajrasakha/chat-window";
import { ThreadSidebar } from "@/components/ajrasakha/thread-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  deleteThread,
  deriveTitle,
  listThreads,
  loadThread,
  newThreadId,
  saveThread,
  type ChatThread,
  type ThreadSummary,
} from "@/lib/chat-storage";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UIMessage } from "ai";
import { Menu } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Refresh sidebar list
  const refreshThreads = useCallback(() => {
    setThreads(listThreads());
  }, []);

  // Load / bootstrap the active thread on threadId change
  useEffect(() => {
    const existing = loadThread(threadId);
    if (existing) {
      setActiveThread(existing);
    } else {
      // Ephemeral thread — not persisted until first message
      setActiveThread({
        id: threadId,
        title: "New conversation",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      });
    }
    refreshThreads();
  }, [threadId, refreshThreads]);

  const handleMessagesChange = useCallback(
    (messages: UIMessage[]) => {
      if (!activeThread) return;
      if (messages.length === 0 && activeThread.messages.length === 0) return;
      const updated: ChatThread = {
        ...activeThread,
        messages,
        updatedAt: Date.now(),
      };
      setActiveThread(updated);
      saveThread(updated);
      refreshThreads();
    },
    [activeThread, refreshThreads],
  );

  const handleFirstUserMessage = useCallback(
    (text: string) => {
      if (!activeThread) return;
      const updated: ChatThread = {
        ...activeThread,
        title: deriveTitle(text),
        updatedAt: Date.now(),
      };
      setActiveThread(updated);
      saveThread(updated);
      refreshThreads();
    },
    [activeThread, refreshThreads],
  );

  const handleNewThread = useCallback(() => {
    setSheetOpen(false);
    navigate({
      to: "/chat/$threadId",
      params: { threadId: newThreadId() },
    });
  }, [navigate]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteThread(id);
      refreshThreads();
    },
    [refreshThreads],
  );

  if (!activeThread) return null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden w-72 shrink-0 md:block">
        <ThreadSidebar
          threads={threads}
          activeId={threadId}
          onNewThread={handleNewThread}
          onDelete={handleDelete}
        />
      </div>

      {/* Mobile: hamburger + Sheet */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-background/80 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open chats">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetTitle className="sr-only">Conversations</SheetTitle>
              <ThreadSidebar
                threads={threads}
                activeId={threadId}
                onNewThread={handleNewThread}
                onDelete={handleDelete}
              />
            </SheetContent>
          </Sheet>
          <span className="truncate px-2 font-display text-sm font-semibold">
            {activeThread.title}
          </span>
          <div className="w-9" />
        </header>

        <ChatWindow
          key={threadId}
          threadId={threadId}
          initialMessages={activeThread.messages}
          onMessagesChange={handleMessagesChange}
          onFirstUserMessage={handleFirstUserMessage}
        />
      </div>
    </div>
  );
}