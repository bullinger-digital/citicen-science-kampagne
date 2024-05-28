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
      publicFolder:
        process.env.NODE_ENV === "development"
          ? "../citizen-science-content/media"
          : "media",
      mediaRoot: "",
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
            templates: [
              {
                name: "FAQ",
                label: "FAQ",
                fields: [
                  {
                    name: "title",
                    type: "string",
                    label: "Title",
                  },
                  {
                    name: "faq",
                    label: "FAQ",
                    type: "object",
                    list: true,
                    ui: {
                      itemProps: (item) => ({
                        label: flattenText(item.question),
                      }),
                    },
                    fields: [
                      {
                        name: "question",
                        type: "rich-text",
                        label: "Question",
                        isBody: true,
                      },
                      {
                        name: "answer",
                        type: "rich-text",
                        label: "Answer",
                        isBody: true,
                      },
                    ],
                  },
                ],
              },
              {
                name: "collapsible",
                label: "Collapsible List",
                fields: [
                  {
                    name: "collapsibles",
                    type: "object",
                    list: true,
                    label: "Collapsibles",
                    ui: {
                      itemProps: (item) => ({
                        label: item.title,
                      }),
                    },
                    fields: [
                      {
                        name: "title",
                        type: "string",
                        label: "Title",
                        isTitle: true,
                        required: true,
                      },
                      {
                        name: "content",
                        type: "rich-text",
                        label: "Content",
                        isBody: true,
                      },
                      {
                        name: "isExpanded",
                        type: "boolean",
                        label: "Is Expanded",
                      },
                    ],
                  },
                ],
              },
            ],
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

// Accpets a nested object and concatenates all strings in .text-properties
const flattenText = (obj: Record<string, any>): string => {
  if (!obj) return "(ohne Titel)";
  return Object.keys(obj).reduce<string>((acc, key) => {
    if (key === "text" && typeof obj[key] === "string") {
      return acc + " " + obj[key];
    }
    if (typeof obj[key] === "object") {
      return acc + flattenText(obj[key]);
    }
    return acc;
  }, "");
};
