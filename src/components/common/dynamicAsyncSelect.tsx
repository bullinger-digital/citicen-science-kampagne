import dynamic from "next/dynamic";
import { GroupBase } from "react-select";
import type { AsyncSelectProps } from "./asyncSelect";

// We need to import react-select asynchronously to avoid SSR issues
const DynamicAsyncSelectInternal = dynamic(() => import("./asyncSelect"), {
  ssr: false,
});

export const DynamicAsyncSelect = <
  OptionType,
  IsMulti extends boolean = false,
  GroupType extends GroupBase<OptionType> = GroupBase<OptionType>,
>(
  props: AsyncSelectProps<OptionType, IsMulti, GroupType>
) => {
  // Hacky way to fix dynamic typing
  const C = DynamicAsyncSelectInternal as any;
  return <C {...props} />;
};
