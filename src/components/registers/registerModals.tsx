"use client";
import { ReactNode, useMemo, useState } from "react";
import Modal from "../common/modal";
import {
  useReactTable,
  ColumnDef,
  getCoreRowModel,
  createColumnHelper,
  flexRender,
  PaginationState,
  SortingState,
  ColumnSort,
} from "@tanstack/react-table";
import { useServerAction, useServerFetch } from "../common/serverActions";
import {
  FilterTableOptions,
  FilterTableResult,
  searchPerson,
  searchPlace,
} from "@/lib/actions/citizen";
import { Link } from "../common/navigation-block/link";
import { EntityUsagesModalTrigger } from "../editor/properties";
import { FaEdit, FaExternalLinkAlt, FaSearch } from "react-icons/fa";
import { Loading } from "../common/loadingIndicator";
import { EditPersonModal, EditPlaceModal } from "../editor/modals/modals";
import { FaArrowDown, FaArrowUp } from "react-icons/fa6";
import { useUser } from "@auth0/nextjs-auth0/client";
import { isInRole } from "@/lib/security/isInRole";
import { deleteRegisterEntry } from "@/lib/actions/admin";
import { MdDeleteForever } from "react-icons/md";
import { UsageMoverModal } from "../admin/review";
import { Popover } from "../common/info";
import { LuFileWarning } from "react-icons/lu";

type GetColumnsProps = {
  setShowEditModal: (id: number) => void;
  setShowMoveUsagesModal: (id: number) => void;
  deleteAction: (id: number) => void;
  isAdmin: boolean;
};

const getCommonColumns = (type: "person" | "place", props: GetColumnsProps) => {
  const columnHelper =
    createColumnHelper<
      NonNullable<
        Awaited<ReturnType<typeof searchPerson | typeof searchPlace>>
      >["result"][number]
    >();
  return [
    columnHelper.accessor("computed_link_counts", {
      id: "computed_link_counts",
      header: "Referenzen",
      cell: (row) => {
        return (
          <EntityUsagesModalTrigger id={row.row.original.id} table={type}>
            {row.getValue()}
          </EntityUsagesModalTrigger>
        );
      },
    }),
    ...(props.isAdmin
      ? [
          columnHelper.accessor("review_state", {
            id: "review_state",
            header: "Status",
            cell: (row) => {
              const status = row.getValue();
              return (
                <div>
                  {status === "accepted" ? null : (
                    <LuFileWarning
                      className="text-yellow-400"
                      title="Enthält Änderungsvorschläge, die noch nicht akzeptiert wurden"
                    />
                  )}
                </div>
              );
            },
          }),
          columnHelper.display({
            id: "edit",
            header: "",
            cell: (row) => {
              return (
                <Popover content="Bearbeiten" trigger="hover">
                  <button
                    title="Bearbeiten"
                    onClick={() => {
                      props.setShowEditModal(row.row.original.id);
                    }}
                    className="text-emerald-400 hover:text-emerald-500"
                  >
                    <FaEdit />
                  </button>
                </Popover>
              );
            },
          }),
          columnHelper.display({
            id: "moveUsages",
            header: "",
            cell: (row) => {
              return (
                <Popover
                  content={`Referenzen verschieben${row.row.original.computed_link_counts > 50 ? " (aufgrund von Performance-Problemen ist eine Verschiebung von mehr als 50 Referenzen momentan nicht möglich)" : ""}`}
                  trigger="hover"
                >
                  <button
                    title="Referenzen verschieben"
                    onClick={() => {
                      props.setShowMoveUsagesModal(row.row.original.id);
                    }}
                    className="text-emerald-400 hover:text-emerald-500 disabled:text-gray-200"
                    disabled={
                      row.row.original.computed_link_counts === 0 ||
                      row.row.original.computed_link_counts > 50
                    }
                  >
                    <FaExternalLinkAlt className="text-sm" />
                  </button>
                </Popover>
              );
            },
          }),
          columnHelper.display({
            id: "delete",
            header: "",
            cell: (row) => {
              return (
                <Popover content="Eintrag entfernen" trigger="hover">
                  <button
                    onClick={() => {
                      confirm(
                        `Sind Sie sicher, dass Sie den Eintrag ${row.row.original.id} löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`
                      ) && props.deleteAction(row.row.original.id);
                    }}
                    className="text-red-400 hover:text-red-500 disabled:text-gray-200"
                    disabled={row.row.original.computed_link_counts > 0}
                  >
                    <MdDeleteForever />
                  </button>
                </Popover>
              );
            },
          }),
        ]
      : []),
  ];
};

const registerModalSpecs = {
  person: {
    title: "Personen-Register",
    query: searchPerson,
    editModal: EditPersonModal,
    defaultSorting: {
      id: "surname",
      desc: false,
    },
    getColumns: (props: GetColumnsProps) => {
      const columnHelper =
        createColumnHelper<
          NonNullable<
            Awaited<ReturnType<typeof searchPerson>>
          >["result"][number]
        >();

      return [
        columnHelper.accessor("id", {
          id: "id",
          header: "ID",
        }),
        columnHelper.accessor("forename", {
          id: "forename",
          header: "Vorname",
        }),
        columnHelper.accessor("surname", {
          id: "surname",
          header: "Nachname",
        }),
        columnHelper.accessor("gnd", {
          id: "gnd",
          header: "GND-ID",
          cell: (row) => {
            const gndString = row.getValue();
            const gndId = gndString?.replace(
              /https?\:\/\/d-nb.info\/gnd\//i,
              ""
            );
            return gndString ? (
              <Link
                target="_blank"
                href={row.getValue() || ""}
                className="text-emerald-400"
              >
                {gndId || gndString}
              </Link>
            ) : null;
          },
        }),
        ...getCommonColumns("person", props),
      ];
    },
  },
  place: {
    title: "Orts-Register",
    query: searchPlace,
    editModal: EditPlaceModal,
    defaultSorting: {
      id: "settlement",
      desc: false,
    },
    getColumns: (props: GetColumnsProps) => {
      const columnHelper =
        createColumnHelper<
          NonNullable<Awaited<ReturnType<typeof searchPlace>>>["result"][number]
        >();

      return [
        columnHelper.accessor("id", {
          id: "id",
          header: "ID",
        }),
        columnHelper.accessor("settlement", {
          id: "settlement",
          header: "Ort",
        }),
        columnHelper.accessor("district", {
          id: "district",
          header: "Kanton / Bundesland",
        }),
        columnHelper.accessor("country", {
          id: "country",
          header: "Land",
        }),
        columnHelper.accessor("geonames", {
          id: "geonames",
          header: "Geonames-ID",
          cell: (row) => {
            const geonamesString = row.getValue();
            const geonamesId = geonamesString?.replace(
              /https?\:\/\/www.geonames.org\//i,
              ""
            );
            return geonamesString ? (
              <Link
                target="_blank"
                href={geonamesString}
                className="text-emerald-400"
              >
                {geonamesId || geonamesString}
              </Link>
            ) : null;
          },
        }),
        ...getCommonColumns("place", props),
      ];
    },
  },
};

export const OpenRegistersButton = ({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"person" | "place">("person");
  const session = useUser();
  const isLoggedIn = !!session.user;
  const isAdmin = isInRole(session, "admin");

  return !isLoggedIn ? null : (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        title={title}
      >
        {children}
      </button>
      <Modal
        title="Register"
        open={isOpen}
        closeOnOutsideClick={true}
        cancel={() => setIsOpen(false)}
      >
        {isAdmin && (
          <div className="mb-4">
            Erweiterte Funktionen (Referenzen verschieben, direktes Bearbeiten,
            Löschen) sind nur für Administratoren verfügbar.
          </div>
        )}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("person")}
            className={`${
              activeTab === "person" ? "bg-blue-200" : ""
            } p-1 rounded`}
          >
            Personen
          </button>
          <button
            onClick={() => setActiveTab("place")}
            className={`${
              activeTab === "place" ? "bg-blue-200" : ""
            } p-1 rounded`}
          >
            Orte
          </button>
        </div>
        {isOpen && <RegisterModal type={activeTab} key={activeTab} />}
      </Modal>
    </div>
  );
};

const RegisterModal = ({ type }: { type: "person" | "place" }) => {
  const session = useUser();
  const isAdmin = isInRole(session, "admin") || false;
  const specs = registerModalSpecs[type];

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  const defaultSorting: ColumnSort = specs.defaultSorting;

  const [sorting, setSorting] = useState<SortingState>([defaultSorting]);
  const [showEditModal, setShowEditModal] = useState<number | null>();
  const [showMoveUsagesModal, setShowMoveUsagesModal] = useState<
    number | null
  >();
  const sortingOrDefault = sorting.length === 0 ? [defaultSorting] : sorting;

  const deleteAction = useServerAction(deleteRegisterEntry);

  const [query, setQuery] = useState("");

  const { data, loading, refetch } = useServerFetch(
    specs.query as (
      opts: FilterTableOptions
    ) => Promise<FilterTableResult<any>>,
    {
      limit: pagination.pageSize,
      orderBy: {
        column: sortingOrDefault[0].id,
        direction: sortingOrDefault[0].desc ? "desc" : "asc",
      },
      offset: pagination.pageIndex * pagination.pageSize,
      query: query,
    }
  );

  const columns = useMemo(() => {
    return specs.getColumns({
      setShowEditModal,
      deleteAction: async (id: number) => {
        await deleteAction.execute({ id, table: type });
        refetch();
      },
      setShowMoveUsagesModal,
      isAdmin: isAdmin,
    });
  }, [specs, setShowEditModal, deleteAction, refetch, type, isAdmin]);

  const table = useReactTable({
    columns: columns as ColumnDef<any>[],
    data: data?.result || [],
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting: sortingOrDefault },
    rowCount: data?.count || 0,
    enableMultiSort: false,
    onSortingChange: setSorting,
  });

  const EditModal = specs.editModal;

  return (
    <div>
      {showEditModal ? (
        <EditModal
          id={showEditModal}
          close={() => {
            setShowEditModal(null);
            refetch();
          }}
          open={true}
        />
      ) : null}
      {showMoveUsagesModal ? (
        <UsageMoverModal
          table={type}
          fromId={showMoveUsagesModal}
          open={!!showMoveUsagesModal}
          close={() => {
            setShowMoveUsagesModal(null);
            refetch();
          }}
        />
      ) : null}
      <div className="flex items-center space-x-2">
        <FaSearch className="text-gray-300 text-lg my-7" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border p-1 rounded"
        />
        {data?.count ? (
          <div className="text-gray-400">
            {data.count.toLocaleString()} Einträge
          </div>
        ) : null}
        {loading ? <Loading /> : null}
      </div>
      <div className="p-2">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="text-left p-1" key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "cursor-pointer select-none"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                        title={
                          header.column.getCanSort()
                            ? header.column.getNextSortingOrder() === "asc"
                              ? "Sort ascending"
                              : header.column.getNextSortingOrder() === "desc"
                                ? "Sort descending"
                                : "Clear sort"
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: (
                            <FaArrowUp className="inline-block ml-2 -mt-1" />
                          ),
                          desc: (
                            <FaArrowDown className="inline-block ml-2 -mt-1" />
                          ),
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="odd:bg-gray-100" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-1">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            {table.getFooterGroups().map((footerGroup) => (
              <tr key={footerGroup.id}>
                {footerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.footer,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </tfoot>
        </table>
        <div className="h-2" />
        <div className="flex items-center gap-2">
          <button
            className="border rounded p-1"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {"<<"}
          </button>
          <button
            className="border rounded p-1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {"<"}
          </button>
          <button
            className="border rounded p-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {">"}
          </button>
          <button
            className="border rounded p-1"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
          >
            {">>"}
          </button>
          <span className="flex items-center gap-1">
            <div>Seite</div>
            <strong>
              {table.getState().pagination.pageIndex + 1} von{" "}
              {table.getPageCount().toLocaleString()}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
