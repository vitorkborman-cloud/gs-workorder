"use client";

import { useParams } from "next/navigation";
import RdoFormatSwitch from "@/components/rdo/RdoFormatSwitch";

export default function DesktopRdoPage() {
  const params = useParams();
  return <RdoFormatSwitch projectId={params.id as string} rdoId={params.rdoId as string} variant="desktop" />;
}
