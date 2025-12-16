"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { 
  Key, 
  ShieldCheck, 
  ArrowLeft,
  Plus,
  Settings,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
  initialApiKeys: DashboardApiKey[];
};

export default function SettingsClient({
  organizationName,
  isAdmin,
  initialApiKeys,
}: Props) {
  const router = useRouter();
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState(60);
  const [keyType, setKeyType] = useState<"PRODUCTION" | "TEST">("PRODUCTION");

  const { data: keysData, mutate: mutateKeys } = useSWR<{ keys: DashboardApiKey[] }>(
    isAdmin ? "/api/apikeys" : null,
    fetcher,
    {
      fallbackData: { keys: initialApiKeys },
    }
  );

  const keys = keysData?.keys ?? [];
  const activeApiKeys = keys.filter((key) => key.isActive).length;
  const totalUsageCount = keys.reduce((total, key) => total + key.usageCount, 0);

  async function handleCreateApiKey() {
    try {
      const response = await fetch("/api/apikeys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rateLimitPerMin: rateLimit, type: keyType }),
      });

      if (!response.ok) {
        toast.error("Failed to create API key");
        return;
      }

      const json = await response.json();
      setPlainKey(json.plain as string);
      toast.success("API key created");
      mutateKeys();
    } catch {
      toast.error("Failed to create API key");
    }
  }

  async function handleToggleKey(key: DashboardApiKey) {
    try {
      const response = await fetch(`/api/apikeys/${key.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !key.isActive }),
      });

      if (!response.ok) {
        toast.error("Failed to update API key");
        return;
      }

      toast.success("API key updated");
      mutateKeys();
    } catch {
      toast.error("Failed to update API key");
    }
  }

  async function handleUploadLicense(event: React.ChangeEvent<HTMLInputElement>, type: "words" | "cells" | "total") {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const response = await fetch("/api/admin/license", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        toast.error("Failed to upload license");
        return;
      }

      if (type === "total") {
        toast.success("Aspose.Total license updated (Words & Cells)");
      } else {
        toast.success(`${type === "words" ? "Aspose.Words" : "Aspose.Cells"} license updated`);
      }
    } catch {
      toast.error("Failed to upload license");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -ml-2 text-slate-400 hover:text-slate-100"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-semibold text-slate-50">Settings</h1>
            </div>
            <p className="text-sm text-slate-400 pl-8">Manage organization settings and configurations</p>
          </div>
        </div>

        {/* Stats Summary - "Total as well" */}
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Active API Keys</CardTitle>
              <Key className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{activeApiKeys}</p>
              <p className="text-xs text-slate-500">of {keys.length} total keys</p>
            </CardContent>
          </Card>
          <Card className="rounded-none border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">Total API Usage</CardTitle>
              <Activity className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{totalUsageCount}</p>
              <p className="text-xs text-slate-500">requests processed</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Organization Profile */}
          <Card className="rounded-none border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-slate-100 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Organization Profile
              </CardTitle>
              <CardDescription className="text-slate-400">
                General information about your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-slate-300">Organization Name</Label>
                <Input 
                  value={organizationName} 
                  disabled 
                  className="rounded-none border-slate-700 bg-slate-950/60 text-slate-100"
                />
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              {/* API Keys Management */}
              <Card className="rounded-none border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-slate-100 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    API Keys
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Manage access keys for the external API.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 items-end border-b border-slate-800 pb-6">
                        <div className="space-y-2">
                        <Label htmlFor="keyType" className="text-xs text-slate-300">
                            Key Type
                        </Label>
                        <Select
                            value={keyType}
                            onValueChange={(value) =>
                            setKeyType(value as "PRODUCTION" | "TEST")
                            }
                        >
                            <SelectTrigger className="h-9 rounded-none border-slate-700 bg-slate-950/60 text-xs text-slate-100">
                            <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="PRODUCTION">Production</SelectItem>
                            <SelectItem value="TEST">Test</SelectItem>
                            </SelectContent>
                        </Select>
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="rateLimit" className="text-xs text-slate-300">
                            Rate Limit (req/min)
                        </Label>
                        <Input
                            id="rateLimit"
                            type="number"
                            value={rateLimit}
                            onChange={(event) =>
                            setRateLimit(Number(event.target.value) || 0)
                            }
                            className="h-9 rounded-none border-slate-700 bg-slate-950/60 text-slate-100"
                        />
                        </div>
                        <Button
                        onClick={handleCreateApiKey}
                        className="rounded-none border border-slate-700 bg-slate-100 text-xs font-medium text-slate-900 hover:bg-white md:col-span-2"
                        >
                        <Plus className="mr-2 h-3 w-3" />
                        Generate New API Key
                        </Button>
                    </div>

                    {plainKey && (
                        <div className="rounded-none border border-yellow-500/20 bg-yellow-500/10 p-4">
                            <p className="text-xs font-medium text-yellow-500 mb-1">New API Key Generated</p>
                            <p className="break-all font-mono text-xs text-slate-200 select-all">
                                {plainKey}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2">
                                Copy this key now. You won't be able to see it again.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-xs text-slate-300">Active Keys</Label>
                        <div className="space-y-2">
                        {keys.map((key) => (
                            <div
                            key={key.id}
                            className="flex items-center justify-between rounded-none border border-slate-800 bg-slate-950/30 px-4 py-3"
                            >
                            <div>
                                <div className="flex items-center gap-3">
                                <p className="font-mono text-xs text-slate-100">
                                    {key.key}
                                </p>
                                <span
                                    className={`rounded-sm px-1.5 py-0.5 text-[9px] font-medium ${
                                    key.type === "TEST"
                                        ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    }`}
                                >
                                    {key.type}
                                </span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                Created {new Date(key.createdAt).toLocaleDateString()} · Usage {key.usageCount} · Limit {key.rateLimitPerMin}/min
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant={key.isActive ? "outline" : "default"}
                                className="h-8 rounded-none border-slate-700 bg-slate-800 text-xs text-slate-100 hover:bg-slate-700"
                                onClick={() => handleToggleKey(key)}
                            >
                                {key.isActive ? "Disable" : "Enable"}
                            </Button>
                            </div>
                        ))}
                        {keys.length === 0 && (
                            <p className="text-xs text-slate-500 italic">No API keys created yet.</p>
                        )}
                        </div>
                    </div>
                </CardContent>
              </Card>

              {/* License Management */}
              <Card className="rounded-none border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    License Management
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Update system licenses to remove evaluation limitations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-none border border-blue-500/20 bg-blue-500/10 p-4 mb-4">
                    <div className="space-y-2">
                        <Label htmlFor="totalLicense" className="text-sm font-medium text-blue-400">
                          Aspose.Total License (Recommended)
                        </Label>
                        <Input
                          id="totalLicense"
                          type="file"
                          accept=".lic"
                          onChange={(e) => handleUploadLicense(e, "total")}
                          className="cursor-pointer rounded-none border-blue-500/30 bg-slate-950/60 text-slate-100 file:mr-4 file:rounded-none file:border-0 file:bg-blue-900/40 file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:text-blue-400 hover:file:bg-blue-900/60"
                        />
                        <p className="text-[10px] text-slate-400">
                          Have an Aspose.Total license? Upload it here to automatically apply it to both Words and Cells.
                        </p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wordsLicense" className="text-xs text-slate-300">
                        Aspose.Words License
                      </Label>
                      <Input
                        id="wordsLicense"
                        type="file"
                        accept=".lic"
                        onChange={(e) => handleUploadLicense(e, "words")}
                        className="cursor-pointer rounded-none border-slate-700 bg-slate-950/60 text-slate-100 file:mr-4 file:rounded-none file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:text-slate-100 hover:file:bg-slate-700"
                      />
                      <p className="text-[10px] text-slate-500">
                        Upload .lic file for Word processing
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cellsLicense" className="text-xs text-slate-300">
                        Aspose.Cells License
                      </Label>
                      <Input
                        id="cellsLicense"
                        type="file"
                        accept=".lic"
                        onChange={(e) => handleUploadLicense(e, "cells")}
                        className="cursor-pointer rounded-none border-slate-700 bg-slate-950/60 text-slate-100 file:mr-4 file:rounded-none file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:text-slate-100 hover:file:bg-slate-700"
                      />
                      <p className="text-[10px] text-slate-500">
                        Upload .lic file for Excel processing
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
