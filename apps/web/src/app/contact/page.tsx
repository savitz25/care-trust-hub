import { PublicInformationPage } from "@/components/public-information-page";
import Link from "next/link";
import { brand } from "@/config/brand";
export const metadata = { title: "Contact SeniorTrustHub" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Contact"
      title="Contact SeniorTrustHub"
      intro="For profile corrections, source concerns, or facility representation, use the structured trust request workflow."
    >
      <p>
        <Link className="button button--primary" href="/trust/correction">
          Suggest a correction
        </Link>
      </p>
      <p>
        <Link href="/trust/corrections">Read how corrections work</Link>
      </p>
      <p>
        General questions: <a href={`mailto:${brand.publicContactEmail}`}>{brand.publicContactEmail}</a>
      </p>
    </PublicInformationPage>
  );
}
