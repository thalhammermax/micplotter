import Link from "next/link";

export function ImportMplLink() {
  return (
    <Link className="import-mpl-link" href="/app/import">
      <span>↑</span>
      Import .mpl file
    </Link>
  );
}
