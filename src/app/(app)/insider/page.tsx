import Image from "next/image";
import Logo from "../../../../public/bullinger-digital.svg";
import client from "../../../../tina/__generated__/client";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { components } from "@/components/content/markdownComponents";
import LoginRegisterInfo from "@/components/common/loginRegisterInfo";
import { PageContent } from "@/components/content/pageContent";

export default function InsiderPage() {
  return (
    <main className="px-5 pb-5 text-center font-light mt-5 text-2xl">
      <LoginRegisterInfo />
      <HomePageContent />
    </main>
  );
}

const HomePageContent = async () => {
  return (
    <PageContent
      relativePath="home.mdx"
      DisplayComponent={({ page }) => {
        return (
          <div className="p-10 bg-white shadow-lg text-base font-normal text-left max-w-screen-md mx-auto">
            <Image
              src={Logo}
              width="270"
              className="mb-7"
              alt="Bullinger Digital Logo"
            />
            <div>
              <h1 className="text-3xl font-bold mb-5">{page.page.title}</h1>
              <TinaMarkdown content={page.page.body} components={components} />
            </div>
          </div>
        );
      }}
    />
  );
};
