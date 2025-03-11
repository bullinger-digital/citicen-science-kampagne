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
      <div className="text-base bg-red-100 max-w-3xl p-7 mb-5 mx-auto">
        <h2 className="font-bold mb-2">Kampagne geschlossen</h2>
        Die Mithelfen-Kampagne wurde am 11.03.2025 beendet. Wir danken allen
        Helfenden für den grossen Einsatz! Die in den Briefen annotierten Namen
        sind weiterhin unter{" "}
        <Link
          target="_blank"
          className="underline whitespace-nowrap"
          href="https://www.bullinger-digital.ch"
        >
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
