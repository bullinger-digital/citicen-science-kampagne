"use server";
import "server-only";
import client from "../../../tina/__generated__/client";

export const PageContent = async ({
  relativePath,
  DisplayComponent,
}: {
  relativePath: string;
  DisplayComponent: ({
    page,
  }: {
    page: Awaited<ReturnType<typeof client.queries.page>>["data"];
  }) => JSX.Element;
}) => {
  let errors: any[] | undefined;
  try {
    const result = await client.queries.page({
      relativePath: relativePath,
    });
    if ((result.errors?.length || 0) > 0) {
      errors = result.errors;
    } else {
      return <DisplayComponent page={result.data} />;
    }
  } catch (error) {
    errors = [error];
  }

  console.error(errors);

  return (
    <div className="text-base bg-yellow-100 max-w-3xl p-5 mx-auto">
      Beim Anzeigen des Inhalts ist ein Fehler aufgetreten. Bitte laden Sie die
      Seite neu, um es erneut zu versuchen.
    </div>
  );
};
