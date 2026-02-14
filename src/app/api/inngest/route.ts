import { serve } from "inngest/next";
import { inngest } from "~/lib/inngest/client";
import { triageAndFix } from "~/lib/inngest/functions/triage-and-fix";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [triageAndFix],
});
