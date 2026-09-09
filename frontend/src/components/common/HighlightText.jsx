import React from "react";

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "&" and the word "and" are treated as interchangeable — mirrors the
// backend's buildFuzzySearchPattern (utils/searchRegex.js) so a search for
// "and" highlights "&" in the results (e.g. "Finance & Banking") and vice
// versa, instead of the highlight silently not matching what the backend
// actually found.
const buildFuzzyPattern = (str) =>
  escapeRegExp(str)
    .replace(/&/g, "(?:&|and)")
    .replace(/\band\b/gi, "(?:and|&)");

const HighlightText = ({ text, query }) => {
  const str = text === null || text === undefined ? "" : String(text);
  const q = (query || "").trim();
  if (!q) return <>{str}</>;

  const parts = str.split(new RegExp(`(${buildFuzzyPattern(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
};

export default HighlightText;
