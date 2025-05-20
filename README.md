> [!WARNING]  
> This software is no longer maintained, as the Bullinger Digital project ended in May 2025. The annotations created / improved with this tool are now part of the TEI dataset available at [https://github.com/stazh/bullinger-korpus-tei](https://github.com/stazh/bullinger-korpus-tei).
>
> Originally, there were no plans to release the source code, as the software was specifically tailored to the needs in the Bullinger Digital project and not designed for reuse. However, due to high demand, we’ve decided to make the code public. You're welcome to reuse or adapt parts of it for your own projects.
>
> If you have similar requirements in your project and are interested in this software or need help adopting it to your needs, feel free to reach out to [bullinger-dev@proton.me](mailto:bullinger-dev@proton.me).

# Bullinger Digital: Citizen Science campaign ("Mithelfen-Tool")

## Introduction

This web-based named entity annotation tool was developed for the _Bullinger Digital_ Citizen Science campaign. Its purpose was to annotate person and place names in the [Bullinger Korpus](https://github.com/stazh/bullinger-korpus-tei). The software was built with Next.js (React) and PostgreSQL.

Data was imported into the PostgreSQL database from the GitHub repository. The backend indexed all registered persons and places, along with their annotations within the letter texts. This allowed the system to suggest new annotations dynamically. As the campaign progressed, the application improved its suggestions based on both register entries and existing annotations.

## Key Features

On the frontend, users were able to:

- Annotate person and place names in letter texts, abstracts, and footnotes
- Link annotations to specific persons and places
- Modify person and place records

Data was regularly exported back to the GitHub repository using an automated export process. An admin interface allowed staff to review changes of person/place entries (two-step workflow). It also provided searchable overviews of all registered persons and places, with tools for editing and merging duplicate entries.

A statistics dashboard allowed to track the campagin progress, showing the status (e.g., open, completed) of each letter.

## Tutorial Videos (German)

These videos were used to instruct people how to use the web application and demonstrate some of its key features.

### 📹 Basic Functions

[![Grundfunktionen](https://img.youtube.com/vi/TxxG--D4WrA/0.jpg)](https://www.youtube.com/watch?v=TxxG--D4WrA)

### 🏙️ Adding New Places

[![Neue Ortsnamen erfassen](https://img.youtube.com/vi/tW3a1Y_5zJU/0.jpg)](https://www.youtube.com/watch?v=tW3a1Y_5zJU)

### 👤 Adding New People

[![Neue Personen erfassen](https://img.youtube.com/vi/eNfN9MiJOs8/0.jpg)](https://www.youtube.com/watch?v=eNfN9MiJOs8)

# Technical Documentation

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app). It is not designed for general reuse and comes with specific dependencies that limit portability:

- It’s tightly coupled to the TEI data structure used in the Bullinger Digital project, which has since evolved.
- It relies on a private GitHub repository (via TinaCMS) for some content.

Additionally, it uses [Auth0](https://auth0.com/) for authentication. You’ll need an Auth0 account and valid environment variables to run the application.

## Run the project locally

1. Clone the repository
2. Create an [Auth0](https://auth0.com/) account and configure a new application
3. In the project root, create a `.env` file with the following variables:

   ```env
   AUTH0_SECRET=[your secret]
   AUTH0_BASE_URL='http://localhost:3000'
   AUTH0_ISSUER_BASE_URL=[from Auth0]
   AUTH0_CLIENT_ID=[from Auth0]
   AUTH0_CLIENT_SECRET=[from Auth0]
   DATABASE_URL="postgresql://postgres:example@localhost:6432/citizen-science"
   ```

4. Install [Docker](https://www.docker.com/)
5. Start the PostgreSQL database and pgAdmin:

   ```bash
   docker compose up -d
   ```

6. Run database migrations:

   ```bash
   npm run migrate-dev
   ```

7. Launch the development server:

   ```bash
   npm run dev
   ```

Visit [http://localhost:3000](http://localhost:3000) in your browser to start the app.
