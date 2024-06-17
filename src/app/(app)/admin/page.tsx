import { Review } from "@/components/admin/review";
import { OpenRegistersButton } from "@/components/registers/registerModals";
import { getPeopleOnline } from "@/lib/actions/admin";
import { requireRoleOrThrow } from "@/lib/security/withRequireRole";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { redirect } from "next/navigation";

export default withPageAuthRequired(
  async function AdminPage() {
    try {
      await requireRoleOrThrow("admin");
    } catch (e) {
      redirect("/");
    }

    return (
      <div className=" px-5">
        <h2 className="text-xl">Admin</h2>
        <PeopleOnline />
        <Review />
      </div>
    );
  },
  { returnTo: "/" }
);

const PeopleOnline = async () => {
  const peopleOnline = await getPeopleOnline();
  return <div>{peopleOnline} Benutzer online</div>;
};
