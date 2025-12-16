"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { 
  FileText, 
  CheckCircle2, 
  Key, 
  Activity, 
  RefreshCw, 
  Upload, 
  Loader2,
  LayoutTemplate,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type DashboardDocument = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  version?: number;
};

type DashboardApiKey = {
  id: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  usageCount: number;
  rateLimitPerMin: number;
  type: "PRODUCTION" | "TEST";
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  organizationName: string;
  isAdmin: boolean;
  initialDocuments: DashboardDocument[];
  initialApiKeys: DashboardApiKey[];
};

export default function DashboardClient({
  organizationName,
  isAdmin,
  initialDocuments,
  initialApiKeys,
}: Props) {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: docsData, mutate: mutateDocs } = useSWR<{ documents: DashboardDocument[] }>(
    "/api/documents",
    fetcher,
    {
      fallbackData: { documents: initialDocuments },
    }
  );

  const { data: keysData } = useSWR<{ keys: DashboardApiKey[] }>(
    isAdmin ? "/api/apikeys" : null,
    fetcher,
    {
      fallbackData: { keys: initialApiKeys },
    }
  );

  async function handleUploadChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        setUploadProgress(percent);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        setIsUploading(false);
        setUploadProgress(0);

        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success("Upload started");
          mutateDocs();
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            toast.error(response.error || "Upload failed");
          } catch {
            toast.error("Upload failed");
          }
        }
      }
    };

    xhr.open("POST", "/api/documents/upload");
    xhr.send(formData);
  }

  const documents = docsData?.documents ?? [];
  const keys = keysData?.keys ?? [];

  const totalDocuments = documents.length;
  const completedDocuments = documents.filter((doc) => doc.status === "COMPLETED").length;
  const processingDocuments = documents.filter((doc) => doc.status === "PROCESSING").length;
  const activeApiKeys = keys.filter((key) => key.isActive).length;
  const totalUsageCount = keys.reduce((total, key) => total + key.usageCount, 0);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">{organizationName}</h1>
            <p className="text-sm text-slate-400">Document processing overview</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => mutateDocs()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                router.push("/dashboard/settings");
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="outline"
              className="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              onClick={() => {
                router.push("/dashboard/templates");
              }}
            >
              <LayoutTemplate className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Total documents</CardTitle>
              <FileText className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{totalDocuments}</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Completed documents</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{completedDocuments}</p>
              <p className="mt-1 text-xs text-slate-500">{processingDocuments} processing</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Active API keys</CardTitle>
              <Key className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{activeApiKeys}</p>
              <p className="mt-1 text-xs text-slate-500">of {keys.length} total</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Total API usage</CardTitle>
              <Activity className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">{totalUsageCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-none border border-slate-800 bg-slate-900/80 p-6 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-slate-50">
                  <Upload className="h-4 w-4 text-slate-400" />
                  Upload document
                </p>
                <p className="text-xs text-slate-500">Upload a new source file to process</p>
              </div>
            </div>
            <div className="space-y-4">
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleUploadChange}
                className="cursor-pointer rounded-none border-slate-700 bg-slate-950/60 text-slate-100 file:mr-4 file:rounded-none file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:text-slate-100 hover:file:bg-slate-700"
              />
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <p>Uploading...</p>
                  </div>
                  <Progress value={uploadProgress} className="h-1 bg-slate-800" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-none border border-dashed border-slate-700 bg-slate-900/70 px-6 py-4 text-sm text-slate-200">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-slate-50">
                <LayoutTemplate className="h-4 w-4 text-slate-400" />
                Templates workspace
              </p>
              <p className="text-xs text-slate-500">
                Browse and manage all processed templates in a dedicated list view.
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-none border-slate-600 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-white"
              onClick={() => {
                router.push("/dashboard/templates");
              }}
            >
              Open templates
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
