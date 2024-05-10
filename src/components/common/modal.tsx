import { ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import Draggable from "react-draggable";
import { AiOutlineClose } from "react-icons/ai";

const Modal = ({
  open,
  cancel,
  save,
  title = "Dialog",
  children,
  maxWidth = 1200,
  closeOnOutsideClick = false,
}: {
  open: boolean;
  cancel?: () => any;
  save?: () => any;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  closeOnOutsideClick?: boolean;
}) => {
  const wrapperRef = useRef(null);
  const modalRef = useRef(null);
  return open
    ? createPortal(
        <div
          ref={wrapperRef}
          className="fixed top-0 left-0 w-screen h-screen p-10 overflow-auto"
          style={{ background: "rgba(100,100,100,0.2)" }}
          onClick={(e) =>
            e.target === wrapperRef.current && closeOnOutsideClick && cancel
              ? cancel()
              : null
          }
        >
          <Draggable
            nodeRef={modalRef}
            handle="#drag-handle"
            defaultPosition={{
              x: window.innerWidth / 2 - maxWidth / 2,
              y: 100,
            }}
          >
            <div
              ref={modalRef}
              className={`bg-white rounded-lg shadow-2xl w-full`}
              style={{ minHeight: "100px", maxWidth: maxWidth }}
            >
              <div className="flex justify-between">
                <header
                  id="drag-handle"
                  className="p-4 pl-5 text-2xl cursor-grab"
                >
                  {title}
                </header>
                <button title="Schliessen" className="p-3" onClick={cancel}>
                  <AiOutlineClose className="text-3xl text-gray-400 hover:text-gray-600" />
                </button>
              </div>
              <div className="pb-2 pl-5 pr-5">{children}</div>
              <div className="text-right p-4 pr-5">
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
          </Draggable>
        </div>,
        document.body
      )
    : null;
};

export default Modal;
