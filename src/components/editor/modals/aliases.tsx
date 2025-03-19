import { useState } from "react";
import { InputField, WithLabel } from "./modals";
import { TiDeleteOutline } from "react-icons/ti";

export const AliasesField = ({
  value,
  onChange,
}: {
  value: { forename: string; surname: string; type: string }[];
  onChange: (v: { forename: string; surname: string; type: string }[]) => void;
}) => {
  const [newAlias, setNewAlias] = useState({
    forename: "",
    surname: "",
    type: "alias",
  });

  return (
    <WithLabel label="Namensvarianten">
      <div className="bg-gray-50 p-2">
        <table>
          <tbody>
            {value.map((alias, i) => (
              <tr key={i}>
                <td>{alias.forename}</td>
                <td>{alias.surname}</td>
                <td className="text-right">
                  <button
                    onClick={(e) => {
                      onChange(value.filter((_, j) => j !== i));
                      e.preventDefault();
                    }}
                    className="text-emerald-400"
                    title="Entfernen"
                  >
                    <TiDeleteOutline className="text-xl" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <InputField
                  value={newAlias.forename}
                  onChange={(e) =>
                    setNewAlias({ ...newAlias, forename: e.target.value })
                  }
                  placeholder="Vorname"
                />
              </td>
              <td>
                <InputField
                  value={newAlias.surname}
                  onChange={(e) =>
                    setNewAlias({ ...newAlias, surname: e.target.value })
                  }
                  placeholder="Nachname"
                />
              </td>
              <td>
                <button
                  onClick={(e) => {
                    onChange([...value, newAlias]);
                    setNewAlias({
                      forename: "",
                      surname: "",
                      type: "alias",
                    });
                    e.preventDefault();
                  }}
                  className="text-emerald-400 disabled:text-gray-300"
                  title="Hinzufügen"
                  disabled={!newAlias.forename && !newAlias.surname}
                >
                  Hinzufügen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </WithLabel>
  );
};
