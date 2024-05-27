import { GitStatus } from "@/components/admin/gitStatus";
import { requireRoleOrThrow } from "@/lib/security/withRequireRole";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { redirect } from "next/navigation";

export default withPageAuthRequired(
  async function AdminPage() {
    try {
      await requireRoleOrThrow("data-admin");
    } catch (e) {
      redirect("/");
    }

    return (
      <div className=" px-5">
        <h2 className="text-xl">Data Admin</h2>
        <GitStatus />
      </div>
    );
  },
  { returnTo: "/" }
);
