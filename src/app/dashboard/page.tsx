import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  const [organization, documents, apiKeys] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.document
      .findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      })
      .then((docs) =>
        docs.map((doc) => ({
          id: doc.id,
          name: doc.name,
          status: doc.status,
          createdAt: doc.createdAt.toISOString(),
          version: doc.version,
        }))
      ),
    session.user.role === "ADMIN"
      ? prisma.apiKey
          .findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
          })
          .then((keys) =>
            keys.map((key) => ({
              id: key.id,
              key: key.key,
              isActive: key.isActive,
              createdAt: key.createdAt.toISOString(),
              usageCount: key.usageCount,
              rateLimitPerMin: key.rateLimitPerMin,
              type: key.type,
            }))
          )
      : Promise.resolve([]),
  ]);

  if (!organization) {
    redirect("/login");
  }

  return (
    <DashboardClient
      organizationName={organization.name}
      isAdmin={session.user.role === "ADMIN"}
      initialDocuments={documents}
      initialApiKeys={apiKeys}
    />
  );
}

