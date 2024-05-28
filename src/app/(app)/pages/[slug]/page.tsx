import { TinaMarkdown, TinaMarkdownContent } from "tinacms/dist/rich-text";
import { components } from "@/components/content/markdownComponents";
import { PageContent } from "@/components/content/pageContent";

const Page = async ({ params }: { params: { slug: string } }) => {
  return (
    <PageContent
      relativePath={`${params.slug.toLowerCase()}.mdx`}
      DisplayComponent={({ page }) => (
        <div>
          <h1 className="text-3xl m-8 text-center leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            {page?.page.title}
          </h1>
          <ContentSection content={page.page.body}></ContentSection>
        </div>
      )}
    />
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
