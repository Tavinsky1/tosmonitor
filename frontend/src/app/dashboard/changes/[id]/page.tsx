import ChangeDetailClient from "./ChangeDetailClient";

// Return a single placeholder — CF Pages _redirects serves this for all IDs
export async function generateStaticParams() {
  return [{ id: "_" }];
}

export default function ChangeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <ChangeDetailClient id={params.id} />;
}
