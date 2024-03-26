import { AiOutlineLoading3Quarters } from "react-icons/ai";

export const Loading = () => {
  return (
    <div className="p-4 text-2xl text-center">
      <AiOutlineLoading3Quarters className="inline-block text-gray-400 animate-spin" />
    </div>
  );
};
