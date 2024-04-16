import { aquireLetterLock } from "@/lib/actions/locking";
import { useEffect } from "react";
import { Loading } from "../common/loadingIndicator";
import { useServerFetch } from "../common/serverActions";
import { usePrevious } from "../common/usePrevious";

export const useLetterLock = (letterId: number, onReleased: () => void) => {
  const {
    data: lockResult,
    refetch,
    loading,
    error,
  } = useServerFetch(aquireLetterLock, {
    id: letterId,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 1000 * 20);
    return () => clearInterval(interval);
  }, [letterId, refetch]);

  const previousSuccess = usePrevious(lockResult?.success);
  useEffect(() => {
    if (previousSuccess === false && lockResult?.success) {
      onReleased();
    }
  }, [lockResult?.success, previousSuccess, onReleased]);

  return {
    loading,
    error,
    refetch,
    success: lockResult?.success,
    lockedByName: lockResult?.lockedByName,
  };
};

export const LockOverlay = (props: {
  lock: ReturnType<typeof useLetterLock>;
}) => {
  const { lock } = props;
  return !lock.success && !lock.loading ? (
    <div className="absolute z-50 top-0 left-0 w-full h-full bg-opacity-30 bg-gray-300">
      <div className="mx-auto shadow-lg max-w-screen-md text-center mt-10 bg-white p-6 rounded-lg">
        {lock.lockedByName && (
          <>
            Dieser Brief wird gerade von Benutzer <i>{lock.lockedByName}</i>{" "}
            bearbeitet.
            <TryAgain onTryAgain={lock.refetch} />
          </>
        )}
        {lock.error && (
          <>
            Es ist ein Fehler aufgetreten: {lock.error}
            <TryAgain onTryAgain={lock.refetch} />
          </>
        )}
      </div>
    </div>
  ) : null;
};

const TryAgain = (props: { onTryAgain: () => void }) => {
  return (
    <div>
      <button
        onClick={props.onTryAgain}
        className="bg-emerald-400 hover:bg-emerald-500 text-white mt-4 p-2 rounded-lg"
      >
        Erneut versuchen
      </button>
    </div>
  );
};
