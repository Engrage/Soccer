import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-lg p-10 text-center">
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-slate-400">
        The fixture or page you are looking for is not available.
      </p>
      <Link className="btn-primary mt-6" href="/">
        Back to predictions
      </Link>
    </div>
  );
}
