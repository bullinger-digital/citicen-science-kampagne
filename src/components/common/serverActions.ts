import { useCallback, useEffect, useMemo, useState } from "react";

export const useServerAction = <T, R>(action: (props: T) => Promise<R>) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return useMemo(
    () => ({
      loading,
      error,
      execute: async (props: T) => {
        setLoading(true);
        try {
          setError(null);
          return await action(props);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unbekannter Fehler");
          console.error(e);
          return Promise.reject(e);
        } finally {
          setLoading(false);
        }
      },
    }),
    [action, loading, error]
  );
};

export const useServerFetch = <P, R>(
  action: (props: P) => Promise<R>,
  props: P,
  options: { skip?: boolean } = {
    skip: false,
  }
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<R | null>(null);
  // Make sure action is not executed when props object change by comparing JSON string
  const propsString = JSON.stringify(props);

  const runAction = useCallback(async () => {
    if (options.skip) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    try {
      setError(null);
      setData(await action(JSON.parse(propsString)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setData(null);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [action, propsString, options.skip]);

  useEffect(() => {
    runAction();
  }, [runAction]);

  return {
    loading,
    error,
    data,
    refetch: useCallback(() => runAction(), [runAction]),
  };
};
