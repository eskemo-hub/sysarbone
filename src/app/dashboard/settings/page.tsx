import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  const [organization, apiKeys] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
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
    <SettingsClient
      organizationName={organization.name}
      isAdmin={session.user.role === "ADMIN"}
      initialApiKeys={apiKeys}
    />
  );
}
