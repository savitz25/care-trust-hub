import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NorthDakotaSeniorPage from "./page";

describe("North Dakota senior-care evidence publication", () => {
  it("publishes source-dated counts without making a combined census", () => {
    render(<NorthDakotaSeniorPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /North Dakota senior-care facility classes/i,
    );
    expect(
      screen.getByText(/67 facility-ID observations and 67 distinct displayed facility IDs/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /72 North Dakota nursing-facility provider rows with 72 distinct CCNs and 4,909 CMS-certified beds/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/70 numbered location entries/)).toBeInTheDocument();
    expect(
      screen.getByText(/13 CMS-certified provider rows and 13 distinct CCNs/),
    ).toBeInTheDocument();
    expect(screen.getByText(/not a statewide senior-facility total/i)).toBeInTheDocument();
  });

  it("keeps inaccessible or unlike class populations explicit", () => {
    render(<NorthDakotaSeniorPage />);
    expect(screen.getByText(/linked facility-list PDF returned HTTP 404/)).toBeInTheDocument();
    expect(
      screen.getByText(/Adult day services, adult residential care, ICF\/IID/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /HHS-linked Hospice iQIES report/ })).toHaveAttribute(
      "href",
      "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/HF/Facility%20Reports/ND-Hospice-Facilities.pdf",
    );
    expect(screen.queryByText(/AggregateRating|Trust Score/)).not.toBeInTheDocument();
  });
});
