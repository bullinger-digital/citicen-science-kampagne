"use client";

import { useCallback, useEffect, useState } from "react";
import client from "../../../tina/__generated__/client";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { components } from "../content/markdownComponents";

type InfoMessageResult = Awaited<
  ReturnType<typeof client.queries.info_messageConnection>
>;

export const InfoMessages = () => {
  const [queryResult, setQueryResult] = useState<InfoMessageResult | null>(
    null
  );
  const [visibleMessages, setVisibleMessages] = useState<
    InfoMessageResult["data"]["info_messageConnection"]["edges"] | null
  >(null);

  const updateVisibleMessages = useCallback(() => {
    setVisibleMessages(
      queryResult?.data?.info_messageConnection.edges?.filter(
        (n) =>
          (!n?.node?.showFrom ||
            n?.node?.showFrom <= new Date().toISOString()) &&
          (!n?.node?.showUntil ||
            n?.node?.showUntil >= new Date().toISOString()) &&
          n?.node?.isVisible
      )
    );
  }, [queryResult]);

  const fetchMessages = useCallback(async () => {
    try {
      const infoMessagesResult = await client.queries.info_messageConnection();
      setQueryResult(infoMessagesResult || null);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = window.setInterval(fetchMessages, 1000 * 60 * 5); // 5 minutes;

    return () => {
      clearInterval(interval);
    };
  }, [fetchMessages]);

  useEffect(() => {
    updateVisibleMessages();
  }, [updateVisibleMessages]);

  useEffect(() => {
    const interval = window.setInterval(updateVisibleMessages, 1000 * 60);
    return () => {
      clearInterval(interval);
    };
  }, [updateVisibleMessages]);

  return visibleMessages && visibleMessages.length > 0 ? (
    <div className="bg-yellow-50 p-3 shadow-md">
      {visibleMessages?.map((m, i) => {
        const message = m?.node;
        return (
          <div key={i} className="flex space-x-2">
            <div className="font-bold">{message?.title}:</div>
            <div className="-mb-4">
              <TinaMarkdown components={components} content={message?.body} />
            </div>
          </div>
        );
      })}
    </div>
  ) : null;
};
