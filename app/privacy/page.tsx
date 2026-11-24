import { PageJsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

const description = `How ${SITE.name}'s site handles your data.`;

export const metadata = pageMetadata({ path: "/privacy", title: "Privacy", description });

export default function PrivacyPage() {
  return (
    <>
      <PageJsonLd type="WebPage" path="/privacy" name="Privacy" description={description} />
      <h1>Privacy</h1>
      <p>This site sets no cookies. Email {SITE.email} with any question.</p>
      {/* When Gomnee measurement is switched on, add its short entry here:
          page views and link clicks, counted without cookies or identifiers. */}
    </>
  );
}
