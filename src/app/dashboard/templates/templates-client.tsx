"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Calendar, Hash, Activity, Trash2, Loader2, Pencil, History, MoreHorizontal, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type TemplatesDocument = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  version?: number | null;
};

type AuditLog = {
  id: string;
  action: string;
  details: string | null;
  timestamp: string;
  userId: string | null;
};

type Props = {
  documents: TemplatesDocument[];
};

export default function TemplatesClient({ documents: initialDocuments }: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  
  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename state
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // History state
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload template");
      }

      toast.success("Template uploaded successfully");
      setIsUploadOpen(false);
      setUploadFile(null);
      router.refresh();
    } catch (error) {
      toast.error("Failed to upload template");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete template");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== deleteId));
      toast.success("Template deleted successfully");
      setDeleteId(null);
      router.refresh();
    } catch (error) {
      toast.error("Failed to delete template");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/documents/${renameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameName }),
      });

      if (!res.ok) {
        throw new Error("Failed to rename template");
      }

      const data = await res.json();
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === renameId ? { ...doc, name: data.document.name, version: data.document.version } : doc))
      );
      toast.success("Template renamed successfully");
      setRenameId(null);
      router.refresh();
    } catch (error) {
      toast.error("Failed to rename template");
      console.error(error);
    } finally {
      setIsRenaming(false);
    }
  };

  useEffect(() => {
    if (historyId) {
      setIsLoadingHistory(true);
      fetch(`/api/documents/${historyId}/history`)
        .then((res) => res.json())
        .then((data) => {
          setHistoryLogs(data.logs || []);
        })
        .catch((err) => {
          console.error("Failed to fetch history", err);
          toast.error("Failed to fetch history");
        })
        .finally(() => setIsLoadingHistory(false));
    } else {
      setHistoryLogs([]);
    }
  }, [historyId]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">Templates</h1>
            <p className="text-sm text-slate-400">List view of your processed documents</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-slate-100 text-slate-900 hover:bg-white"
              onClick={() => setIsUploadOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Upload Template
            </Button>
            <Button
              variant="outline"
              className="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                router.push("/dashboard");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-none border border-slate-800 bg-slate-900/80 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-400">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Name
                  </div>
                </TableHead>
                <TableHead className="text-slate-400">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    Status
                  </div>
                </TableHead>
                <TableHead className="text-slate-400">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3 w-3" />
                    Version
                  </div>
                </TableHead>
                <TableHead className="text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Created
                  </div>
                </TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer border-slate-800 hover:bg-slate-800/80"
                  onClick={() => {
                    router.push(`/dashboard/documents/${doc.id}`);
                  }}
                >
                  <TableCell className="text-slate-100">{doc.name}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-slate-400">
                    {doc.status}
                  </TableCell>
                  <TableCell className="text-slate-200">{doc.version ?? 1}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(doc.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-slate-800 bg-slate-900 text-slate-100">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameName(doc.name);
                            setRenameId(doc.id);
                          }}
                          className="focus:bg-slate-800 focus:text-slate-100"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryId(doc.id);
                          }}
                          className="focus:bg-slate-800 focus:text-slate-100"
                        >
                          <History className="mr-2 h-4 w-4" />
                          Version History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(doc.id);
                          }}
                          className="text-red-400 focus:bg-red-950/20 focus:text-red-300"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-slate-600" />
                      <p>No templates available yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => {
        if (!open) {
            setIsUploadOpen(false);
            setUploadFile(null);
        }
      }}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Upload Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              Upload a new template file (PDF, DOCX, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="file" className="text-slate-300">File</Label>
              <Input
                id="file"
                type="file"
                className="cursor-pointer border-slate-700 bg-slate-950 text-slate-100 file:text-slate-100"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUploadFile(file);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800"
              onClick={() => setIsUploadOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              className="bg-slate-100 text-slate-900 hover:bg-white"
              onClick={handleUpload}
              disabled={!uploadFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800"
              onClick={() => setDeleteId(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-900 text-red-100 hover:bg-red-800"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter a new name for your template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-slate-300">
                Name
              </Label>
              <Input
                id="name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="col-span-3 border-slate-700 bg-slate-950 text-slate-100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800"
              onClick={() => setRenameId(null)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              className="bg-slate-100 text-slate-900 hover:bg-white"
              onClick={handleRename}
              disabled={isRenaming}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyId} onOpenChange={(open) => !open && setHistoryId(null)}>
        <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription className="text-slate-400">
              View the activity log for this template.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {isLoadingHistory ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-slate-500">
                <History className="mb-2 h-6 w-6" />
                <p>No history available.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyLogs.map((log) => (
                  <div key={log.id} className="flex gap-4 border-b border-slate-800 pb-4 last:border-0">
                    <div className="mt-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                        <Activity className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-200">{log.action.replace(/_/g, " ")}</p>
                        <span className="text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-sm text-slate-400">{log.details}</p>
                      )}
                      {log.userId && (
                         <p className="text-xs text-slate-600">User ID: {log.userId}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

