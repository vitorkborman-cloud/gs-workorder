"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import RdoV2Editor from "@/components/rdo/RdoV2Editor";
import RdoMobileV1 from "@/components/rdo/RdoMobileV1";
import RdoDesktopV1 from "@/components/rdo/RdoDesktopV1";

// RDOs antigos (formato 'v1') seguem nas telas antigas, intactas; os criados
// a partir do RDO simplificado (formato 'v2') usam o formulário novo.
export default function RdoFormatSwitch({
  projectId,
  rdoId,
  variant,
}: {
  projectId: string;
  rdoId: string;
  variant: "mobile" | "desktop";
}) {
  const [formato, setFormato] = useState<"v1" | "v2" | null>(null);

  useEffect(() => {
    supabase
      .from("rdo_reports")
      .select("formato")
      .eq("id", rdoId)
      .single()
      .then(({ data }) => setFormato(data?.formato === "v2" ? "v2" : "v1"));
  }, [rdoId]);

  if (formato === null) {
    return <div className="p-10 text-center text-gray-500 animate-pulse">Carregando...</div>;
  }
  if (formato === "v2") return <RdoV2Editor projectId={projectId} rdoId={rdoId} variant={variant} />;
  return variant === "mobile" ? <RdoMobileV1 /> : <RdoDesktopV1 />;
}
