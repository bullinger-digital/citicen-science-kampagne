import { ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

const Modal = ({
  open,
  cancel,
  save,
  title = "Dialog",
  children,
  maxWidth,
}: {
  open: boolean;
  cancel?: () => any;
  save?: () => any;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}) => {
  const wrapperRef = useRef(null);
  return open
    ? createPortal(
        <div
          ref={wrapperRef}
          className="fixed top-0 left-0 flex items-start justify-center w-screen h-screen p-10 overflow-auto"
          style={{ background: "rgba(100,100,100,0.2)" }}
          onClick={(e) =>
            e.target === wrapperRef.current && cancel ? cancel() : null
          }
        >
          <div
            className={`bg-white rounded-lg shadow-2xl w-full`}
            style={{ minHeight: "100px", maxWidth: maxWidth || 1200 }}
          >
            <header className="p-4 pl-5 text-2xl">{title}</header>
            <div className="pb-4 pl-5 pr-5">{children}</div>
            <div className="float-right p-4 pr-5">
              <button
                onClick={cancel}
                className="px-2 py-1 text-white bg-gray-300 rounded-md"
              >
                Schliessen
              </button>
              {save && (
                <button
                  onClick={save}
                  className="px-2 py-1 ml-1 text-white bg-emerald-600 rounded-md"
                >
                  Speichern
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
};

export default Modal;
