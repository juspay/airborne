import React from "react";
import ThemedImage from "@theme/ThemedImage";
import useBaseUrl from "@docusaurus/useBaseUrl";

type ScreenshotProps = {
  /** File name (without extension) under static/docs_static/img/screenshots/{light,dark}/ */
  name: string;
  /** Accessible alt text. Falls back to the caption or name. */
  alt?: string;
  /** Optional caption rendered under the image. */
  caption?: React.ReactNode;
  /** Optional max width (e.g. "720px") to constrain narrow dialogs. */
  width?: string;
};

/**
 * Theme-aware product screenshot. Renders the light capture in light mode and
 * the dark capture in dark mode, both captured from the live Airborne dashboard.
 */
export default function Screenshot({ name, alt, caption, width }: ScreenshotProps): React.JSX.Element {
  const light = useBaseUrl(`/docs_static/img/screenshots/light/${name}.png`);
  const dark = useBaseUrl(`/docs_static/img/screenshots/dark/${name}.png`);
  const altText = alt ?? (typeof caption === "string" ? caption : name);

  return (
    <figure className="ab-shot" style={width ? { maxWidth: width, marginInline: "auto" } : undefined}>
      <ThemedImage alt={altText} sources={{ light, dark }} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
