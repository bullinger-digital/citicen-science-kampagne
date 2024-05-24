import {
  TinaMarkdown,
  TinaMarkdownContent,
  Components,
} from "tinacms/dist/rich-text";
import client from "../../../../../tina/__generated__/client";

const Page = async ({ params }: { params: { slug: string } }) => {
  const { data } = await client.queries.page({
    relativePath: `${params.slug.toLowerCase()}.mdx`,
  });

  return (
    <>
      <div>
        <div>
          <h1 className="text-3xl m-8 text-center leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            {data?.page.title}
          </h1>
          <ContentSection content={data.page.body}></ContentSection>
        </div>
      </div>
    </>
  );
};

export default Page;

const components: Components<{}> = {
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
};

const ContentSection = ({ content }: { content: TinaMarkdownContent }) => {
  return (
    <div className="relative py-16 bg-white overflow-hidden text-black">
      <div className="relative px-4 sm:px-6 lg:px-8">
        <div className="text-lg max-w-prose mx-auto">
          <TinaMarkdown components={components} content={content} />
        </div>
      </div>
    </div>
  );
};
