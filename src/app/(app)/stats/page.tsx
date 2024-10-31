import { getCurrentUserId } from "@/lib/actions/citizen";
import { getLetterStats, getUserStats } from "@/lib/actions/stats";
import { isInRole } from "@/lib/security/isInRole";
import { getSession } from "@auth0/nextjs-auth0";

export const dynamic = "force-dynamic";

export default function StatisticsPage() {
  return (
    <main className="px-5 pb-5 max-w-screen-xl mx-auto">
      <h1 className="text-center font-light mt-5 text-3xl mb-10">
        Statistiken
      </h1>
      <div className="flex space-x-20">
        <div className="w-60">
          <PercentageChart />
        </div>
        <div className="w-full">
          <LeaderBoard />
        </div>
      </div>
      <div className="text-center text-sm max-w-screen-sm mx-auto mt-10 mb-5">
        Hinweise: Die Statistiken werden aus Performance-Gründen nur alle 60
        Minuten neu berechnet. Die Punktevergabe dient nur zur Einschätzung der
        Aktivität und kann im Verlauf des Projekts noch angepasst werden.
      </div>
    </main>
  );
}

const PercentageChart = async () => {
  const letterStats = await getLetterStats();
  const session = await getSession();
  const isAdmin = session ? isInRole(session, "admin") : false;

  const finishedCount = parseInt(
    letterStats.letterStats.find((s) => s.extract_status === "finished")
      ?.count || "0"
  );
  const totalCount =
    letterStats.letterStats.reduce<number>(
      (acc, s) => acc + parseInt(s.count),
      0
    ) || 0;
  const percentage = finishedCount / totalCount;

  return (
    <div className="text-center">
      <div
        className="relative w-52 h-52 rounded-[50%] bg-red mb-3"
        style={{
          background: `conic-gradient(rgb(16 185 129) ${Math.round(360 * percentage)}deg, #DDD ${Math.round(360 * percentage)}deg 360deg)`,
        }}
      >
        <div className="absolute w-32 h-32 bg-white left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
      </div>
      Fortschritt:{" "}
      <span className="font-bold">{(percentage * 100).toFixed(1)}%</span>
      <br />
      {finishedCount} von {totalCount} zu bearbeitenden Briefen abgeschlossen
      {isAdmin && (
        <div className="text-sm mt-5 text-gray-400">
          (<i>Nur für Administratoren sichtbar</i>:{" "}
          {
            letterStats.editedLettersStats.find(
              (s) => s.extract_status === "finished"
            )?.count
          }{" "}
          von{" "}
          {letterStats.editedLettersStats.reduce<number>(
            (acc, s) => acc + parseInt(s.count),
            0
          )}{" "}
          edierten Briefen abgeschlossen)
        </div>
      )}
    </div>
  );
};

const CELL_CLASSNAMES = "p-1";

const LeaderBoard = async () => {
  const userStats = await getUserStats();
  const currentUser = await getCurrentUserId();

  return (
    <div className="p-10 bg-white shadow-lg text-base font-normal text-left">
      <h1 className="text-3xl font-bold mb-5">Leaderboard</h1>
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${CELL_CLASSNAMES}`}>Rang</th>
            <th className={`${CELL_CLASSNAMES}`}>Benutzer-ID</th>
            <th className={`${CELL_CLASSNAMES}`}>Punkte</th>
          </tr>
        </thead>
        <tbody>
          {userStats.map((user, index) => (
            <tr
              key={user.id}
              className={
                user.id === currentUser?.id
                  ? "bg-emerald-200"
                  : "odd:bg-gray-50"
              }
            >
              <td className={CELL_CLASSNAMES}>{index + 1}</td>
              <td className={CELL_CLASSNAMES}>
                {user.id} {user.id === currentUser?.id ? "(Sie)" : null}
              </td>
              <td className={CELL_CLASSNAMES}>{user.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
