"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { FaDice } from "react-icons/fa6";
import { Link } from "./common/navigation-block/link";
import { useServerFetch } from "./common/serverActions";
import { getLatestWork } from "@/lib/actions/citizen";

export default function RecentWork() {
  const user = useUser();
  const latestWork = useServerFetch(getLatestWork, {});
  return !user.user || !latestWork.data?.length ? null : (
    <div className="mt-4">
      Zuletzt von Ihnen bearbeitete Briefe:{" "}
      <table className="max-w-80 mx-auto mt-4">
        <tbody>
          {latestWork.data.map((work) => (
            <tr key={work.id}>
              <td>
                <Link href={`/letter/${work.id}`} className="underline">
                  {work.id}
                </Link>
              </td>
              <td className="text-left pl-5">
                {work.timestamp
                  ? timeAgo(new Date(work.timestamp), new Date())
                  : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const timeAgo = (date1: Date, date2 = new Date()) => {
  try {
    const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

    const elapsed = date1.getTime() - date2.getTime(); // Difference in milliseconds

    // Convert the elapsed time to a relative time format
    const units = [
      { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
      { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
      { unit: "day", ms: 1000 * 60 * 60 * 24 },
      { unit: "hour", ms: 1000 * 60 * 60 },
      { unit: "minute", ms: 1000 * 60 },
      { unit: "second", ms: 1000 },
    ] as const;

    for (const { unit, ms } of units) {
      if (Math.abs(elapsed) >= ms || unit === "second") {
        const value = Math.round(elapsed / ms);
        return rtf.format(value, unit);
      }
    }
  } catch (e) {
    console.error(e);
    return "";
  }
};
