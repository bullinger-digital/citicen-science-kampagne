import Modal from "@/components/common/modal";
import { Link } from "@/components/common/navigation-block/link";
import { useServerFetch } from "@/components/common/serverActions";
import { getPersonUsages, getPlaceUsages } from "@/lib/actions/citizen";
import { Versioned } from "@/lib/versioning";

export const UsagesModal = ({
  table,
  id,
  open,
  close,
}: {
  table: Extract<Versioned, "place" | "person">;
  id: number;
  open: boolean;
  close: () => void;
}) => {
  const result = useServerFetch(
    table === "place" ? getPlaceUsages : getPersonUsages,
    { id }
  );

  return (
    <Modal
      open={open}
      cancel={close}
      closeOnOutsideClick={true}
      title={`Referenzen zur ${table === "person" ? "Person" : "Ort"} ${id}`}
    >
      {result.loading && <p>Loading...</p>}
      {result.error && <p>Error: {result.error}</p>}
      {!result.loading && !result.error && !result.data?.length && (
        <p>Keine Referenzen gefunden.</p>
      )}
      {result.data && result.data.length > 0 && (
        <table className="table table-fixed w-full">
          <thead>
            <tr className="text-left">
              <th>Typ</th>
              <th className="w-1/3">Text</th>
              <th>Verifiziert</th>
              <th>Brief ID</th>
              <th>Briefdatum</th>
            </tr>
          </thead>
          {result.data.map((usage, i) => (
            <tr className="even:bg-gray-100" key={i}>
              <td>
                {usage.link_type === "mentioned"
                  ? "Erwähnung"
                  : usage.link_type === "correspondent"
                    ? "Korrespondent"
                    : usage.link_type === "origin"
                      ? "Absendeort"
                      : ""}
              </td>
              <td>{usage.node_text}</td>
              <td>{usage.cert === "high" ? "Ja" : "Nein"}</td>
              <td>
                <Link
                  className="text-emerald-400"
                  target="_blank"
                  href={`/letter/${usage.id}#highlight=${encodeURIComponent(
                    table === "place"
                      ? `placeName[ref=l${id}]`
                      : `persName[ref=p${id}]`
                  )}`}
                >
                  {usage.id}
                </Link>
              </td>
              <td>{usage.extract_date_string}</td>
            </tr>
          ))}
        </table>
      )}
    </Modal>
  );
};
