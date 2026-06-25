import React from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

type Card = {
  title: string;
  description: string;
  to: string;
};

const sections: Card[] = [
  {
    title: "React Native SDK",
    description: "Boot from an OTA bundle on Android & iOS. Install, native setup, and the full JS / native API reference.",
    to: "/docs/react-native-sdk/integration/getting-started",
  },
  {
    title: "React Native CLI",
    description: "airborne-devkit: scaffold local config, bundle, upload files, and cut packages from your RN project.",
    to: "/docs/react-native-cli/getting-started",
  },
  {
    title: "Core CLI",
    description: "airborne-core-cli: the low-level, Smithy-generated client for organisations, files, packages, and releases.",
    to: "/docs/core-cli/getting-started",
  },
  {
    title: "Server",
    description: "Self-host the Airborne control plane. Architecture, every environment variable, and AWS deployment guides.",
    to: "/docs/server/overview",
  },
  {
    title: "Dashboard",
    description: "Create releases, target by dimension and version cohort, ramp traffic, and watch adoption — feature by feature.",
    to: "/docs/dashboard/overview",
  },
  {
    title: "Guides",
    description: "End-to-end walkthroughs: integrate the SDK, ship from the CLI, and create & target your first release.",
    to: "/docs/guides/integrate-react-native",
  },
];

const capabilities = [
  { title: "Ship instantly", body: "Push JS and assets over-the-air — no app store review for code-level updates." },
  { title: "Precise targeting", body: "Roll out by dimensions and version cohorts with semver checkpoints." },
  { title: "Safe rollouts", body: "Ramp traffic gradually between control and experiment, and revert in one click." },
  { title: "Real-time analytics", body: "Track adoption, downloads, and errors as a release ramps." },
];

function Hero() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className="container">
        <div className={styles.heroInner}>
          <span className={styles.kicker}>Over-the-air updates for mobile &amp; JS</span>
          <h1 className={styles.heroTitle}>{siteConfig.title} documentation</h1>
          <p className={styles.heroSubtitle}>
            Deliver code and asset updates to your React Native, Android, and iOS apps over-the-air — with
            precise targeting, instant rollbacks, and real-time analytics. Use the Juspay-hosted service or
            self-host the whole stack.
          </p>
          <div className={styles.heroButtons}>
            <Link className="button button--primary button--lg" to="/docs/guides/integrate-react-native">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/intro">
              Browse the docs
            </Link>
          </div>
          <div className={styles.capabilities}>
            {capabilities.map((c) => (
              <div key={c.title} className={styles.capability}>
                <strong>{c.title}</strong>
                <span>{c.body}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} docs`}
      description="Documentation for Airborne — over-the-air updates for React Native, Android, and iOS."
    >
      <Hero />
      <main className="container margin-vert--xl">
        <h2 className={styles.sectionTitle}>Explore the documentation</h2>
        <div className="row">
          {sections.map((s) => (
            <div key={s.title} className="col col--4 margin-bottom--lg">
              <Link className="ab-card" to={s.to}>
                <h3>{s.title}</h3>
                <p className={styles.cardBody}>{s.description}</p>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
