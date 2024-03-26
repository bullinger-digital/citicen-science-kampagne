import React, { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconType } from "react-icons";
import { FaInfoCircle } from "react-icons/fa";
import { useOutsideClick } from "./useOutsideClick";

type PopoverProps = {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
  inline?: boolean;
  pointer?: boolean;
  allowPinning?: boolean;
};

const PopoverContent = ({
  parentRef,
  pointer,
  content,
}: {
  parentRef: React.RefObject<HTMLElement>;
  pointer: boolean;
  content: ReactNode;
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(0);
  useLayoutEffect(() => {
    setPopoverWidth(popoverRef.current?.getBoundingClientRect().width);
  }, [popoverRef]);

  const targetRefRect = parentRef?.current?.getBoundingClientRect();
  const topPos = (targetRefRect?.top || 0) + window?.scrollY;
  const leftPos = Math.max(
    (targetRefRect?.left || 0) +
      (targetRefRect?.width || 0) / 2 -
      (popoverWidth || 0) / 2,
    0
  );

  return (
    <>
      <div
        ref={popoverRef}
        data-test="popover"
        style={{
          top: topPos,
          left: leftPos,
        }}
        className={`absolute transform -translate-y-full z-999 ${
          pointer ? "" : "pointer-events-none"
        }`}
      >
        <div
          className={`max-w-sm py-2 px-2 mb-2 text-sm text-center text-fieldgray-800 border rounded shadow-lg bg-gray-50 border-fieldgray-100 border-1`}
        >
          {content}
        </div>
      </div>
      <div
        style={{
          top: topPos,
          left: (targetRefRect?.left || 0) + (targetRefRect?.width || 0) / 2,
          borderTopColor: "#b3c1b7",
          marginTop: "-1px",
        }}
        className="absolute w-0 h-0 transform -translate-x-1/2 -translate-y-2 border-8 border-transparent z-999"
      ></div>
    </>
  );
};

export const Popover = ({
  content,
  children,
  className = "",
  inline = false,
  pointer = true,
}: PopoverProps) => {
  const [visible, setVisible] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);
  useOutsideClick(targetRef, (_) => {
    setVisible(false);
  });

  return content ? (
    <span
      className={`cursor-pointer relative ${
        inline ? "" : "inline-block"
      } ${className}`}
      onClick={() => setVisible(true)}
      ref={targetRef}
    >
      {children}
      {visible
        ? createPortal(
            <PopoverContent
              parentRef={targetRef}
              pointer={pointer}
              content={content}
            />,
            document.body
          )
        : null}
    </span>
  ) : (
    <>{children}</>
  );
};

export const InfoIcon = (
  props: PopoverProps & { icon?: IconType; iconClassName?: string }
) => {
  const Icon = props.icon || FaInfoCircle;
  return (
    <Popover className="ml-1" {...props}>
      <Icon
        className={`relative top-0.5 text-fieldgray-200 ${props.iconClassName}`}
      />
    </Popover>
  );
};
