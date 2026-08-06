import React from "react";

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const HighlightText = ({ text, query }) => {
  const str = text === null || text === undefined ? "" : String(text);
  const q = (query || "").trim();
  if (!q) return <>{str}</>;

  const parts = str.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
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
