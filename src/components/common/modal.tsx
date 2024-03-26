import { ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

const Modal = ({
  open,
  cancel,
  save,
  title = "Dialog",
  children,
}: {
  open: boolean;
  cancel?: () => any;
  save?: () => any;
  title?: ReactNode;
  children: ReactNode;
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
            className="w-full bg-white rounded-lg shadow-2xl"
            style={{ minHeight: "100px" }}
          >
            <header className="p-4 pl-5 text-2xl">{title}</header>
            <div className="pb-4 pl-5 pr-5">{children}</div>
            <div className="float-right p-4 pr-5">
              {save && (
                <button
                  onClick={save}
                  className="px-2 py-1 mr-1 text-white bg-red-600 rounded-sm"
                >
                  Save
                </button>
              )}
              <button
                onClick={cancel}
                className="px-2 py-1 text-white bg-red-600 rounded-sm"
              >
                Schliessen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
};

export default Modal;
