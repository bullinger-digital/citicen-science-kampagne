import { useState } from "react";
import { Components, TinaMarkdown } from "tinacms/dist/rich-text";
import { Collapsible } from "../common/collapsible";
import { Link } from "../common/navigation-block/link";

export const components: Components<{
  FAQ: {
    title?: string;
    faq?: {
      question?: any;
      answer?: any;
    }[];
  };
  collapsible: {
    collapsibles?: {
      title?: string;
      content?: any;
      isExpanded?: boolean;
    }[];
  };
  button_pdf: {
    title: string;
    pdf?: string;
  };
  youtube_video: {
    url?: string;
  };
}> = {
  p: (props) => <p className="mb-4">{props?.children}</p>,
  ol: (props) => (
    <ol className="list-decimal list-outside mb-4">{props?.children}</ol>
  ),
  ul: (props) => (
    <ul className="list-disc list-outside my-4">{props?.children}</ul>
  ),
  lic: (props) => {
    return <>{props?.children}</>;
  },
  li: (props) => {
    return <li className="mb-2 ml-10">{props?.children}</li>;
  },
  a: (props) => (
    <a
      className="text-blue-500 hover:underline"
      href={props?.url}
      target="_blank"
    >
      {props?.children}
    </a>
  ),
  h1: (props) => <h1 className="text-2xl font-bold mb-4">{props?.children}</h1>,
  h2: (props) => <h2 className="text-xl font-bold mb-4">{props?.children}</h2>,
  h3: (props) => <h3 className="text-lg font-bold mb-4">{props?.children}</h3>,
  h4: (props) => (
    <h4 className="text-base font-bold mb-4">{props?.children}</h4>
  ),
  code_block: (props) => (
    <>
      <pre className="bg-gray-100 p-4 rounded-md mb-4 text-wrap">
        {props?.value}
      </pre>
    </>
  ),
  FAQ: (props) => {
    return (
      <div>
        <h3 className="text-xl mb-2">{props.title}</h3>
        <ul>
          {props.faq?.map((f, i) => (
            <li key={i}>
              <h4 className="font-bold mb-1">
                <TinaMarkdown content={f.question} components={components} />
              </h4>
              <TinaMarkdown content={f.answer} components={components} />
            </li>
          ))}
        </ul>
      </div>
    );
  },
  collapsible: (props) => {
    return (
      <div className="mt-6">
        {props.collapsibles?.map((c, i) => {
          return (
            <Collapsible
              key={i}
              title={c.title || "(ohne Titel)"}
              content={c.content}
              isExpanded={c.isExpanded || false}
            />
          );
        })}
      </div>
    );
  },
  button_pdf: (props) => {
    return (
      <Link
        href={props.pdf || "#"}
        className="inline-block hover:underline mb-4 bg-emerald-300 p-3 hover:bg-emerald-400 rounded-md"
        target="_blank"
      >
        {props.title}
      </Link>
    );
  },
  youtube_video: (props) => {
    // Extract video id from URL
    const videoId =
      props.url?.split("v=")[1] || props.url?.split("youtu.be/")[1];

    if (!videoId) return <div>Video nicht konfiguriert</div>;

    return (
      <div>
        <iframe
          width="560"
          height="315"
          className="max-w-full"
          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
          title="YouTube video player"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        ></iframe>
      </div>
    );
  },
};
