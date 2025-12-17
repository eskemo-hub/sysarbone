"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, Trash2, FileJson, FileText, RotateCcw, ImageIcon, List, Type, ScanLine, Edit, X, AlertCircle, HelpCircle, Code } from "lucide-react";

const TiptapEditor = dynamic(() => import("@/components/editor/tiptap-editor"), { ssr: false });

type DocumentDetails = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  version?: number;
  mapping?: string | null;
};

export default function DocumentDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [documentDetails, setDocumentDetails] = useState<DocumentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapping, setMapping] = useState("{}");
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const [isSavingContent, setIsSavingContent] = useState(false);

  const [activeTab, setActiveTab] = useState<"curl" | "js" | "python">("curl");

  useEffect(() => {
    try {
      JSON.parse(mapping);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  }, [mapping]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  useEffect(() => {
    const id = params.id;
    if (!id || typeof id !== "string") {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) {
          toast.error("Failed to load document");
          return;
        }
        const json = await res.json();
        const doc = json.document as DocumentDetails;
        if (cancelled) {
          return;
        }
        setDocumentDetails({
          id: doc.id,
          name: doc.name,
          status: doc.status,
          createdAt: doc.createdAt,
          version: doc.version,
          mapping: doc.mapping,
        });
        setMapping(doc.mapping ?? "{}");
      } catch {
        if (!cancelled) {
          toast.error("Failed to load document");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleSaveMapping = async () => {
    if (!documentDetails) return;
    try {
      setIsSavingMapping(true);
      JSON.parse(mapping);
    } catch {
      toast.error("Mapping must be valid JSON");
      setIsSavingMapping(false);
      return;
    }
    try {
      const res = await fetch(`/api/documents/${documentDetails.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mapping }),
      });
      if (!res.ok) {
        toast.error("Failed to load preview");
        return;
      }
      toast.success("Preview loaded");
      setPreviewRevision((current) => current + 1);
    } catch {
      toast.error("Failed to load preview");
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!documentDetails) return;
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.doc,.docx,.xls,.xlsx";
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(
          `/api/documents/upload?rootId=${documentDetails.id}`,
          {
            method: "POST",
            body: formData,
          }
        );
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          toast.error(errorData.error || "Failed to upload new version");
        } else {
          const data = await res.json();
          toast.success("New version uploaded");
          if (data.document?.id) {
            router.push(`/dashboard/documents/${data.document.id}`);
          } else {
            // Fallback if no ID returned (shouldn't happen with current API)
            setPreviewRevision((current) => current + 1);
          }
        }
      } catch {
        toast.error("Failed to upload new version");
      }
    };
    fileInput.click();
  };

  const handleDelete = async () => {
    if (!documentDetails) return;
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/documents/${documentDetails.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete document");
        return;
      }
      toast.success("Document deleted");
      router.push("/dashboard/templates");
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReloadTemplate = async () => {
    if (!documentDetails) return;
    try {
      setIsSavingMapping(true);
      // Reset to empty JSON
      const emptyMapping = "{}";
      setMapping(emptyMapping);
      
      const res = await fetch(`/api/documents/${documentDetails.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mapping: emptyMapping }),
      });
      
      if (!res.ok) {
        toast.error("Failed to reload template");
        return;
      }
      
      toast.success("Template reloaded");
      setPreviewRevision((current) => current + 1);
    } catch {
      toast.error("Failed to reload template");
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleScan = async () => {
    if (!documentDetails) return;
    try {
      setIsScanning(true);
      const res = await fetch(`/api/documents/${documentDetails.id}/scan`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Failed to scan document");
        return;
      }
      const data = await res.json();
      const newMapping = JSON.stringify(data.mapping, null, 2);
      setMapping(newMapping);
      toast.success("Document scanned and mapping generated");
    } catch {
      toast.error("Failed to scan document");
    } finally {
      setIsScanning(false);
    }
  };

  const insertAtCursor = (textToInsert: string) => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    // Simple heuristic to add commas if needed
    let prefix = "";
    const trimmedBefore = before.trim();
    if (trimmedBefore && !trimmedBefore.endsWith("{") && !trimmedBefore.endsWith("[") && !trimmedBefore.endsWith(",")) {
      prefix = ",\n  ";
    }

    const newText = before + prefix + textToInsert + after;
    setMapping(newText);

    // Defer focus to allow React render
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleAddText = () => {
    insertAtCursor('"newKey": "value"');
  };

  const handleAddList = () => {
    insertAtCursor('"myList": [\n    {\n      "name": "Item 1"\n    },\n    {\n      "name": "Item 2"\n    }\n  ]');
  };

  const handleAddImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Prompt for dimensions
        const width = prompt("Enter width in pixels (optional):");
        const height = prompt("Enter height in pixels (optional):");
        
        let value = base64;
        if (width) value += `|width=${width}`;
        if (height) value += `|height=${height}`;
        
        insertAtCursor(`"myImage": "${value}"`);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleEditToggle = async () => {
    if (!isEditing) {
      // Enter edit mode
      try {
        setIsLoading(true);
        const res = await fetch(`/api/documents/${id}/content`);
        if (!res.ok) throw new Error("Failed to load content");
        const html = await res.text();
        setEditorContent(html);
        setIsEditing(true);
      } catch (e) {
        toast.error("Failed to load document content");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Exit edit mode
      if (confirm("Exit without saving?")) {
        setIsEditing(false);
      }
    }
  };

  const handleSaveContent = async () => {
    try {
      setIsSavingContent(true);
      const res = await fetch(`/api/documents/${id}/content`, {
        method: "POST",
        body: editorContent,
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Document saved");
      setPreviewRevision((c) => c + 1);
      setIsEditing(false);
    } catch (e) {
      toast.error("Failed to save document");
    } finally {
      setIsSavingContent(false);
    }
  };

  const id = typeof params.id === "string" ? params.id : "";

  const getApiUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/external/generate/${id}`;
  };

  const getCodeSnippet = (type: "curl" | "js" | "python") => {
    const url = getApiUrl();
    const data = mapping || "{}";
    
    switch (type) {
      case "curl":
        return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '${data.replace(/'/g, "'\\''")}' \\
  --output generated_document.pdf`;
      case "js":
        return `const response = await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY"
  },
  body: JSON.stringify(${data})
});

if (response.ok) {
  const blob = await response.blob();
  // Handle the PDF blob (e.g., download it)
} else {
  console.error("Generation failed");
}`;
      case "python":
        return `import requests
import json

url = "${url}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY"
}
data = ${data}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    with open("generated_document.pdf", "wb") as f:
        f.write(response.content)
else:
    print("Generation failed:", response.text)`;
      default:
        return "";
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-none h-8 w-8"
            onClick={() => router.push("/dashboard/templates")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">{documentDetails?.name || "Loading..."}</h1>
              {documentDetails?.status && (
                <span className="inline-flex items-center rounded-none bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {documentDetails.status}
                </span>
              )}
            </div>
            {documentDetails && (
              <span className="text-xs text-muted-foreground">
                Version {documentDetails.version ?? 1} · Created {new Date(documentDetails.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none h-8"
                onClick={() => handleEditToggle()}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-none h-8"
                onClick={handleSaveContent}
                disabled={isSavingContent}
              >
                <Save className="mr-2 h-3.5 w-3.5" />
                {isSavingContent ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-none h-8">
                    <HelpCircle className="mr-2 h-3.5 w-3.5" />
                    Help
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>How to use this service</DialogTitle>
                    <DialogDescription>
                      A quick guide to managing and automating your documents.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">1. Document Templates</h3>
                      <p className="text-sm text-muted-foreground">
                        Upload your Word documents (.docx) to use as templates. The system supports placeholders like{" "}
                        <code className="bg-muted px-1 py-0.5 rounded mx-1">{"{{key}}"}</code> or{" "}
                        <code className="bg-muted px-1 py-0.5 rounded mx-1">{"<<[key]>>"}</code>.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">2. Data Mapping</h3>
                      <p className="text-sm text-muted-foreground">
                        Use the <strong>Mapping Preview</strong> pane on the left to test your template. Enter a JSON object matching your placeholders, then click <strong>Load preview</strong> to see the result on the right.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">3. Live Editing</h3>
                      <p className="text-sm text-muted-foreground">
                        Need to make quick changes? Click <strong>Edit Document</strong> to open the built-in editor. You can modify text, tables, and formatting directly in the browser. Save your changes to update the template.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">4. API Integration</h3>
                      <p className="text-sm text-muted-foreground">
                        Once your template is ready, use the API to generate documents automatically. Send a POST request with your JSON data to fill the placeholders programmatically.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="h-4 w-px bg-border" />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-none h-8">
                    <Code className="mr-2 h-3.5 w-3.5" />
                    Integration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>API Integration</DialogTitle>
                    <DialogDescription>
                      Use the API to generate PDFs from this template programmatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2 border-b">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`rounded-none border-b-2 ${activeTab === "curl" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
                        onClick={() => setActiveTab("curl")}
                      >
                        cURL
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`rounded-none border-b-2 ${activeTab === "js" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
                        onClick={() => setActiveTab("js")}
                      >
                        JavaScript
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={`rounded-none border-b-2 ${activeTab === "python" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
                        onClick={() => setActiveTab("python")}
                      >
                        Python
                      </Button>
                    </div>
                    <div className="relative rounded-md bg-slate-950 p-4">
                      <pre className="max-h-[60vh] overflow-auto font-mono text-sm text-slate-50">
                        {getCodeSnippet(activeTab)}
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 h-6 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(getCodeSnippet(activeTab));
                          toast.success("Copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Note: Replace <code className="bg-muted px-1 rounded">YOUR_API_KEY</code> with a valid API key from your dashboard settings.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                className="rounded-none h-8"
                onClick={handleEditToggle}
                disabled={!documentDetails}
              >
                <Edit className="mr-2 h-3.5 w-3.5" />
                Edit Document
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                className="rounded-none h-8"
                onClick={handleUploadVersion}
                disabled={!documentDetails}
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload new version
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-none h-8"
                onClick={handleDelete}
                disabled={isDeleting || !documentDetails}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
              <div className="ml-2 h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none h-8"
                onClick={handleScan}
                disabled={isScanning || !documentDetails}
                title="Scan document for fields"
              >
                <ScanLine className="mr-2 h-3.5 w-3.5" />
                Scan
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none h-8"
                onClick={handleReloadTemplate}
                disabled={isSavingMapping || !documentDetails}
                title="Clear mapping and show original template"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reload Template
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                className="rounded-none h-8 min-w-[120px]"
                onClick={handleSaveMapping}
                disabled={isSavingMapping || !documentDetails}
              >
                {isSavingMapping ? (
                  "Loading..."
                ) : (
                  <>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    Load preview
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Editor */}
        <div className={`flex w-[40%] min-w-[350px] flex-col border-r bg-slate-950 ${isEditing ? "hidden" : ""}`}>
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4">
            <div className="flex items-center gap-2 text-slate-400">
              <FileJson className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">Mapping Preview</span>
            </div>
            <div className="flex items-center gap-1">
               <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={handleAddText}
                title="Add Text Field"
              >
                <Type className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={handleAddList}
                title="Add Repeating Section"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={handleAddImage}
                title="Add Image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative flex-1 flex flex-col min-h-0">
            <div className="relative flex-1 flex min-h-0">
              <div
                ref={lineNumbersRef}
                className="flex flex-col items-end border-r border-slate-800 bg-slate-900 py-4 pr-3 text-right font-mono text-sm leading-6 text-slate-600 select-none overflow-hidden w-10 shrink-0"
                aria-hidden="true"
              >
                {mapping.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                className="flex-1 resize-none border-0 bg-transparent p-4 font-mono text-sm leading-6 text-slate-50 outline-none selection:bg-blue-500/30 whitespace-pre"
                value={mapping}
                onChange={(e) => setMapping(e.target.value)}
                onScroll={handleScroll}
                spellCheck={false}
                placeholder="{}"
              />
            </div>
            {jsonError && (
              <div className="flex items-center gap-2 border-t border-red-900/50 bg-red-950/50 px-4 py-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-mono">{jsonError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Preview */}
        <div className="flex flex-1 flex-col bg-gray-100/50">
          <div className="flex h-9 shrink-0 items-center border-b bg-white px-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              {isEditing ? <Edit className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              <span className="text-xs font-medium uppercase tracking-wider">
                {isEditing ? "Document Editor" : "Document Preview"}
              </span>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden bg-white">
            {isEditing ? (
              <TiptapEditor content={editorContent} onChange={setEditorContent} />
            ) : isLoading || !documentDetails ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading preview...
              </div>
            ) : (
              <iframe
                key={previewRevision}
                title={documentDetails.name}
                src={`/api/documents/${id}/file?rev=${previewRevision}`}
                className="h-full w-full border-0"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
