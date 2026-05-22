# React-Three-Fiber Starter

Starter project consisting of React-Three-Fiber, Tailwind, Bun, and Typescript.

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

To deploy to GitHub Pages:

1. In the repository settings, open Pages and set Build and deployment source
   to GitHub Actions.
2. Push to `main`, or run the "Deploy GitHub Pages" workflow manually.
3. The app is published as a static project site at
   `https://<owner>.github.io/atoms/`.

The workflow assumes Pages has already been enabled in the repository settings.
GitHub's `GITHUB_TOKEN` can deploy a Pages artifact, but it cannot enable Pages
for a repository that has never had Pages configured.

GitHub Pages hosts only the static React app from `dist`. It does not run the
Bun server or expose server-side API routes.

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
