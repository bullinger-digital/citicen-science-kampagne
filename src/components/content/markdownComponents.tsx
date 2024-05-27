import { Components } from "tinacms/dist/rich-text";
import { FAQ } from "./FAQ";

export const components: Components<{
  FAQ: { title: string };
}> = {
  p: (props) => <p className="mb-4">{props?.children}</p>,
  ol: (props) => (
    <ol className="list-decimal list-outside mb-4">{props?.children}</ol>
  ),
  ul: (props) => (
    <ul className="list-disc list-outside my-4">{props?.children}</ul>
  ),
  lic: (props) => {
    return <>{props?.children}</>;
  },
  li: (props) => {
    return <li className="mb-2 ml-10">{props?.children}</li>;
  },
  a: (props) => (
    <a
      className="text-blue-500 hover:underline"
      href={props?.url}
      target="_blank"
    >
      {props?.children}
    </a>
  ),
  h1: (props) => <h1 className="text-2xl font-bold mb-4">{props?.children}</h1>,
  h2: (props) => <h2 className="text-xl font-bold mb-4">{props?.children}</h2>,
  h3: (props) => <h3 className="text-lg font-bold mb-4">{props?.children}</h3>,
  h4: (props) => (
    <h4 className="text-base font-bold mb-4">{props?.children}</h4>
  ),
  code_block: (props) => (
    <>
      <pre className="bg-gray-100 p-4 rounded-md mb-4 text-wrap">
        {props?.value}
      </pre>
    </>
  ),
  FAQ: (props) => {
    return <FAQ title={props.title} />;
  },
};
