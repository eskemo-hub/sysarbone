import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import TemplatesClient from "./templates-client";

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.organizationId) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;

  const documents = await prisma.document
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
      })),
    );

  return <TemplatesClient documents={documents} />;
}

