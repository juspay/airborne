import React from "react";
import Head from "@docusaurus/Head";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function Home(): React.JSX.Element {
  // Trailing slash matches trailingSlash: true (avoids a redirect hop to /docs/).
  const docsUrl = useBaseUrl("/docs/");
  return (
    <>
      <Head>
        <title>Airborne documentation</title>
        <meta httpEquiv="refresh" content={`0; url=${docsUrl}`} />
        <link rel="canonical" href={docsUrl} />
      </Head>
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        Redirecting to the <Link to="/docs/">Airborne documentation</Link>…
      </main>
    </>
  );
}
