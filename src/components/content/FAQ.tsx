"use client";

import { TinaMarkdown } from "tinacms/dist/rich-text";
import client from "../../../tina/__generated__/client";
import { useEffect, useState } from "react";
import { components } from "./markdownComponents";

export const FAQ = ({ title }: { title: string }) => {
  const [faq, setFaq] = useState<Awaited<
    ReturnType<typeof client.queries.faqConnection>
  > | null>(null);

  useEffect(() => {
    (async () => {
      const result = await client.queries.faqConnection({});
      setFaq(result);
    })();
  }, []);

  return (
    <div>
      <h3 className="text-xl mb-2">{title}</h3>
      <ul>
        {faq?.data.faqConnection.edges?.map((edge) => (
          <li key={edge?.node?.id}>
            <h4 className="font-bold mb-1">{edge?.node?.question}</h4>
            <TinaMarkdown
              content={edge?.node?.answer}
              components={components}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
