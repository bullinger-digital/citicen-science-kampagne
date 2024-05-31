import { DataAdminActions } from "@/components/admin/actions";
import { Logs } from "@/components/admin/logs";
import { Review } from "@/components/admin/review";
import { isInRole } from "@/lib/security/isInRole";
import { requireRoleOrThrow } from "@/lib/security/withRequireRole";
import { getSession, withPageAuthRequired } from "@auth0/nextjs-auth0";
import { redirect } from "next/navigation";

export default withPageAuthRequired(
  async function AdminPage() {
    try {
      await requireRoleOrThrow("admin");
    } catch (e) {
      redirect("/");
    }

    const user = await getSession();
    const isDataAdmin = isInRole(user!, "data-admin");

    return (
      <div className=" px-5">
        <h2 className="text-xl">Admin</h2>
        <Review />
        {isDataAdmin && <DataAdminActions />}
        <Logs />
      </div>
    );
  },
  { returnTo: "/" }
);
