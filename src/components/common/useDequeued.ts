import { useState, useEffect } from "react";

export const useDequeued = (value: string, intervalMs: number) => {
  const [dequeuedValue, setDequeuedValue] = useState(value);
  const [queueing, setQueueing] = useState(false);

  useEffect(() => {
    setQueueing(true);
    const timeout = setTimeout(() => {
      setDequeuedValue(value);
      console.log("Dequeued value", value);
      setQueueing(false);
    }, intervalMs);
    return () => clearTimeout(timeout);
  }, [value, intervalMs]);

  return { dequeuedValue, queueing };
};
