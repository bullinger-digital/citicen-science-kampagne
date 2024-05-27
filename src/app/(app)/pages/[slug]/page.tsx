import { TinaMarkdown, TinaMarkdownContent } from "tinacms/dist/rich-text";
import client from "../../../../../tina/__generated__/client";
import { components } from "@/components/content/markdownComponents";

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
