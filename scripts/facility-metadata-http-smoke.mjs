const baseUrl = "http://127.0.0.1:3000";
const homeTitle = "SeniorTrustHub — CMS Senior Care Research, Ownership & Quality Data";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function metas(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\bname=["']${escaped}["'])[^>]*>`,
    "gi",
  );
  return [...html.matchAll(pattern)].map(
    ([tag]) => tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "",
  );
}

function properties(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\bproperty=["']${escaped}["'])[^>]*>`,
    "gi",
  );
  return [...html.matchAll(pattern)].map(
    ([tag]) => tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "",
  );
}

function canonicalLinks(html) {
  const tags = [...html.matchAll(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi)];
  return tags.map(([tag]) => tag.match(/\bhref=["']([^"']*)["']/i)?.[1] ?? "");
}

async function request(path, { userAgent } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: userAgent ? { "user-agent": userAgent } : {},
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let firstChunk = "";
  let fullHtml = "";
  let first = true;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullHtml += chunk;
    if (first) {
      firstChunk = chunk;
      first = false;
    }
  }
  fullHtml += decoder.decode();
  return { response, firstChunk, fullHtml };
}

function assert404Metadata(label, result, expectedTitle) {
  const { response, firstChunk, fullHtml } = result;
  assert(response.status === 404, `${label}_status_expected_404_actual_${response.status}`);
  const robotValues = metas(fullHtml, "robots").map((value) => value.toLowerCase());
  assert(robotValues.some((value) => value.includes("noindex")), `${label}_missing_noindex`);
  assert(
    robotValues.every((value) => !/(^|[,\s])index([,\s]|$)/.test(value)),
    `${label}_contains_indexable_robots:${robotValues.join("|")}`,
  );
  const canonicals = canonicalLinks(fullHtml);
  assert(
    canonicals.every((value) => {
      const url = new URL(value, baseUrl);
      return !(url.origin === "https://www.seniortrusthub.com" && url.pathname === "/");
    }),
    `${label}_canonical_points_to_homepage:${canonicals.join("|")}`,
  );
  const titles = properties(fullHtml, "og:title");
  const twitterTitles = metas(fullHtml, "twitter:title");
  assert(!titles.includes(homeTitle), `${label}_inherited_homepage_open_graph_title`);
  assert(!twitterTitles.includes(homeTitle), `${label}_inherited_homepage_twitter_title`);
  assert(
    properties(fullHtml, "og:image").length === 0,
    `${label}_inherited_homepage_open_graph_image`,
  );
  assert(
    metas(fullHtml, "twitter:image").length === 0,
    `${label}_inherited_homepage_twitter_image`,
  );
  assert(fullHtml.includes(expectedTitle), `${label}_missing_route_title`);
  const headEnd = fullHtml.indexOf("</head>");
  const head = fullHtml.slice(0, headEnd + 7);
  const fullHasNoindex = metas(fullHtml, "robots").some((value) =>
    value.toLowerCase().includes("noindex"),
  );
  const headHasNoindex = metas(head, "robots").some((value) =>
    value.toLowerCase().includes("noindex"),
  );
  console.log(`${label}_status=${response.status}`);
  console.log(`${label}_initial_html_bytes=${new TextEncoder().encode(firstChunk).length}`);
  const noindexLocation = headHasNoindex
    ? "initial-head"
    : fullHasNoindex
      ? "streamed-html"
      : "missing";
  console.log(`${label}_noindex_location=${noindexLocation}`);
  const initialChunkHasNoindex = metas(firstChunk, "robots").some((value) =>
    value.toLowerCase().includes("noindex"),
  );
  console.log(`${label}_noindex_in_initial_network_chunk=${initialChunkHasNoindex}`);
  console.log(`${label}_canonical_count=${canonicals.length}`);
  console.log(`${label}_robots=${robotValues.join("|")}`);
}

const generic = await request("/definitely-missing-ci-route");
assert404Metadata("generic_missing", generic, "Page not found");

const missingProvider = await request("/facility/cms/999999/missing-facility");
assert404Metadata("missing_provider", missingProvider, "Facility not found");

const malformed = await request("/facility/cms/55305/x");
assert404Metadata("malformed_provider", malformed, "Facility not found");

const bot = await request("/definitely-missing-ci-route", {
  userAgent: "facebookexternalhit/1.1",
});
assert404Metadata("generic_missing_bot", bot, "Page not found");
const botHeadEnd = bot.fullHtml.indexOf("</head>");
const botHead = bot.fullHtml.slice(0, botHeadEnd + 7);
assert(
  metas(botHead, "robots").some((value) => value.toLowerCase().includes("noindex")),
  "bot_metadata_not_in_initial_head",
);

const valid = await request("/facility/cms/010001/synthetic-ci-facility");
assert(
  valid.response.status === 200,
  `valid_provider_status_expected_200_actual_${valid.response.status}`,
);
assert(
  canonicalLinks(valid.fullHtml).includes(
    "https://www.seniortrusthub.com/facility/cms/010001/synthetic-ci-facility",
  ),
  "valid_provider_missing_self_canonical",
);
const validRobots = metas(valid.fullHtml, "robots").map((value) => value.toLowerCase());
assert(
  validRobots.some(
    (value) => value.includes("index") && value.includes("follow") && !value.includes("noindex"),
  ),
  "valid_provider_not_indexable",
);
assert(
  properties(valid.fullHtml, "og:title").some((value) => value.includes("Synthetic CI Facility")),
  "valid_provider_missing_open_graph_title",
);
console.log(`valid_provider_status=${valid.response.status}`);
console.log(`valid_provider_canonical=${canonicalLinks(valid.fullHtml).join("|")}`);
console.log(`valid_provider_robots=${validRobots.join("|")}`);
