"use client";
import { useState } from "react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { components } from "../content/markdownComponents";
import { FaChevronDown, FaChevronRight } from "react-icons/fa6";

export const Collapsible = ({
  title,
  content,
  isExpanded,
}: {
  title: string;
  content: any;
  isExpanded: boolean;
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  return (
    <div className="border-b border-gray-200 mb-5">
      <div
        className="flex space-x-2 pb-3 items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          <FaChevronRight
            className={`inline-block relative -top-0.5 transform transition-all ${expanded ? "rotate-90" : ""}`}
          />
        </span>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      {expanded && (
        <div className="p-4 bg-gray-100 rounded-md">
          <TinaMarkdown content={content} components={components} />
        </div>
      )}
    </div>
  );
};
