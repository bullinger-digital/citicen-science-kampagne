import dynamic from "next/dynamic";
import { ComponentType, useCallback } from "react";
import { GroupBase, OptionsOrGroups } from "react-select";
import AsyncReactSelect, { AsyncProps } from "react-select/async";

function debounce<T extends (...args: any[]) => any>(fn: T, delay = 250) {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

export type AsyncSelectProps<
  OptionType,
  IsMulti extends boolean,
  GroupType extends GroupBase<OptionType>,
> = AsyncProps<OptionType, IsMulti, GroupType> & {
  loadOptions?: (
    inputValue: string
  ) => Promise<OptionsOrGroups<OptionType, GroupType>>;
};

const AsyncSelect = <
  OptionType,
  IsMulti extends boolean = false,
  GroupType extends GroupBase<OptionType> = GroupBase<OptionType>,
>(
  props: AsyncProps<OptionType, IsMulti, GroupType> & {
    loadOptions?: (
      inputValue: string
    ) => Promise<OptionsOrGroups<OptionType, GroupType>>;
  }
) => {
  /* eslint-disable react-hooks/exhaustive-deps */
  const debouncedLoadOptions = useCallback(
    debounce(
      async (
        inputValue: string,
        callback: (options: OptionsOrGroups<OptionType, GroupType>) => void
      ) => {
        console.log("Debounced called");
        callback(await props.loadOptions!(inputValue));
      },
      500
    ),
    [props.loadOptions]
  );

  return (
    <AsyncReactSelect
      {...props}
      classNames={{
        control: (i) =>
          "!w-full !px-2 !py-2 !shadow-none !border-t-0 !border-l-0 !border-r-0 !rounded-none !outline-none !border-b-2 !border-gray-300 !outline-none !focus:border-beige-500 !placeholder-gray-300 !text-gray-300",
        valueContainer: (i) => "!p-0",
      }}
      loadingMessage={props.loadingMessage || (() => "Bitte warten...")}
      noOptionsMessage={props?.noOptionsMessage || (() => "Keine Ergebnisse")}
      loadOptions={props.loadOptions ? debouncedLoadOptions : undefined}
    />
  );
};

export default AsyncSelect;
