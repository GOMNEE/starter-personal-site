import { PageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

const description = `Who ${SITE.name} is, and why this site exists.`;

export const metadata = pageMetadata({ path: "/about", title: "About", description });

export default function AboutPage() {
  return (
    <>
      <PageJsonLd type="AboutPage" path="/about" name="About" description={description} />
      <h1>About</h1>
      {/* Real facts only, from you. No invented clients, numbers or quotes. */}
      <p>I&apos;m {SITE.name}. Write two or three sentences about who you are and what you write about.</p>
    </>
  );
}
