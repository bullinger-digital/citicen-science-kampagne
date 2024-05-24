import { defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,
  localContentPath: "../../citizen-science-content",

  // Get this from tina.io
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  // Get this from tina.io
  token: process.env.TINA_TOKEN,

  build: {
    outputFolder: "admin-content",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },
  // See docs on content modeling for more info on how to setup new content models: https://tina.io/docs/schema/
  schema: {
    collections: [
      {
        name: "info_message",
        label: "Info Messages",
        path: "content/info-messages",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
          {
            type: "datetime",
            name: "showFrom",
            label: "Anzeigen ab",
          },
          {
            type: "datetime",
            name: "showUntil",
            label: "Anzeigen bis",
          },
        ],
        // ui: {
        //   // This is an DEMO router. You can remove this to fit your site
        //   router: ({ document }) => `/insider?`,
        // },
      },
      {
        name: "page",
        label: "Seiten",
        format: "mdx",
        path: "content/pages",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "slug",
            label: "Slug",
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
        ],
        // ui: {
        //   // // This is an DEMO router. You can remove this to fit your site
        //   // router: ({ document }) => `/pages/${document._sys.filename}`,
        //   filename: ({ document }) => `${document.slug}.mdx`,
        // },
      },
      {
        name: "menu",
        label: "Menu",
        format: "md",
        path: "content/menu",
        fields: [
          {
            type: "string",
            name: "menu_id",
            label: "Menu ID",
            isTitle: true,
            required: true,
          },
          {
            type: "object",
            name: "menu",
            label: "Menu",
            list: true,
            ui: {
              itemProps: (item) => ({
                label: item.page,
              }),
            },
            fields: [
              {
                type: "reference",
                name: "page",
                label: "Seite",
                collections: ["page"],
              },
            ],
          },
        ],
      },
    ],
  },
});
