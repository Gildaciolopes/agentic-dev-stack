"use client";

import { useTranslations } from "next-intl";
import { useToast } from "@/components/site/toast";
import { DoctorDemo } from "./doctor-demo.client";

/** Server components cannot pass `onDone` (a function); this wires the demo to the site-wide toast. */
export function DoctorDemoWithToast() {
  const t = useTranslations("landing-b.one.doctor");
  const toast = useToast();
  return <DoctorDemo onDone={() => toast.show(t("toast"))} />;
}
