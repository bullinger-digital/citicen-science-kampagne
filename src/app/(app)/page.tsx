import Image from "next/image";
import Logo from "../../../public/bullinger-digital.svg";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { components } from "@/components/content/markdownComponents";
import LoginRegisterInfo from "@/components/common/loginRegisterInfo";
import { PageContent } from "@/components/content/pageContent";
import { Link } from "@/components/common/navigation-block/link";

export default function Home() {
  return (
    <main className="px-5 pb-5 text-center font-light mt-5 text-2xl">
      <LoginRegisterInfo />
      <div className="text-base bg-yellow-100 max-w-3xl p-5 mb-5 mx-auto">
        Die Mithelfen-Kampagne endet per 10.03.2025. Danach wird dieses Tool
        nicht mehr verfügbar sein. Die in den Briefen annotierten Namen sind
        anschliessend weiterhin unter{" "}
        <Link className="underline" href="https://www.bullinger-digital.ch">
          www.bullinger-digital.ch
        </Link>{" "}
        einsehbar.
      </div>
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
